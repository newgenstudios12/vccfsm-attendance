(() => {
'use strict';
if (window.__VCCF_MEMBER_NUMBER_NORMALIZE_V1__) return;
window.__VCCF_MEMBER_NUMBER_NORMALIZE_V1__ = true;

const state = () => window.VCCF?.getState?.() || {};
const client = () => window.VCCF?.sb;
const byId = new Map();
const legacyToNumber = new Map();
let loading = null;
let refreshTimer = null;
let paintTimer = null;
let lastRefresh = 0;
let started = false;

const memberName = member => member?.display_name || [member?.first_name, member?.last_name].filter(Boolean).join(' ') || 'Member';
const legacyPattern = /\b[A-F0-9]{12}\b/i;

function absorb(rows = []) {
  for (const member of rows) {
    if (!member?.id || !member?.member_number) continue;
    byId.set(String(member.id), member);
    if (member.member_code && member.member_code !== member.member_number) {
      legacyToNumber.set(String(member.member_code), String(member.member_number));
    }
  }
  const appMembers = state().members || [];
  for (const member of appMembers) {
    const current = byId.get(String(member.id));
    if (current?.member_number) member.member_number = current.member_number;
  }
}

async function loadNumbers(force = false) {
  const db = client();
  if (!db || !state().session?.user) return;
  if (loading) return loading;
  if (!force && byId.size) return;
  loading = (async () => {
    const { data, error } = await db.from('members')
      .select('id,member_number,member_code,display_name,first_name,last_name');
    if (error) throw error;
    absorb(data || []);
    lastRefresh = Date.now();
  })().catch(error => console.warn('Member number display refresh:', error)).finally(() => { loading = null; });
  return loading;
}

function rewriteText(root) {
  if (!root || !legacyToNumber.size) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let value = node.nodeValue || '';
    if (!value) continue;
    let changed = false;
    for (const [legacy, permanent] of legacyToNumber) {
      if (!value.includes(legacy)) continue;
      value = value.split(legacy).join(permanent);
      changed = true;
    }
    if (changed) node.nodeValue = value;
  }
}

function rewriteMemberSelect(select) {
  if (!select) return;
  const linkedMemberSelect = select.matches('select[name="member_id"],#acMember');
  if (!linkedMemberSelect) return;
  for (const option of select.options) {
    if (!option.value) continue;
    const member = byId.get(String(option.value));
    if (!member?.member_number) continue;
    const expected = `${memberName(member)} · ${member.member_number}`;
    if (option.textContent !== expected) option.textContent = expected;
  }
}

function rewriteDirectoryRows() {
  const search = document.getElementById('vccfCleanSearch');
  if (search && search.placeholder !== 'Search name, member number, or address') {
    search.placeholder = 'Search name, member number, or address';
  }
  document.querySelectorAll('#members .vccf-clean-status[data-id]').forEach(status => {
    const member = byId.get(String(status.dataset.id || ''));
    if (!member?.member_number) return;
    const row = status.closest('tr');
    const code = row?.querySelector('.vccf-clean-member small');
    if (code && code.textContent !== member.member_number) code.textContent = member.member_number;
  });
}

function rewritePlaceholders() {
  document.querySelectorAll('input[placeholder]').forEach(input => {
    const value = input.placeholder || '';
    if (/member code/i.test(value)) input.placeholder = value.replace(/member code/ig, 'member number');
  });
}

function hasUnknownLegacyCode() {
  const roots = [
    document.getElementById('members'),
    document.getElementById('church'),
    document.getElementById('vccfAdminAccountDialog'),
    document.getElementById('vccfAdminAccountManager')
  ].filter(Boolean);
  return roots.some(root => {
    const match = (root.textContent || '').match(legacyPattern);
    return !!match && !legacyToNumber.has(match[0]);
  });
}

function paint() {
  document.querySelectorAll('select[name="member_id"],#acMember').forEach(rewriteMemberSelect);
  rewriteDirectoryRows();
  rewritePlaceholders();
  rewriteText(document.getElementById('members'));
  rewriteText(document.getElementById('church'));
  rewriteText(document.getElementById('vccfAdminAccountDialog'));
  rewriteText(document.getElementById('vccfAdminAccountManager'));

  if (hasUnknownLegacyCode() && Date.now() - lastRefresh > 1200) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      await loadNumbers(true);
      paint();
    }, 120);
  }
}

function schedulePaint() {
  clearTimeout(paintTimer);
  paintTimer = setTimeout(paint, 40);
}

async function start() {
  if (started || !state().session?.user || !client()) return;
  started = true;
  absorb(state().members || []);
  await loadNumbers(!byId.size);
  paint();
  const observer = new MutationObserver(schedulePaint);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('input', event => {
    if (event.target?.id === 'vccfCleanSearch' && /^VCCF-\d{1,6}$/i.test(String(event.target.value || '').trim())) {
      schedulePaint();
    }
  }, true);
}

window.addEventListener('vccf-app-ready', start);
if (document.getElementById('app')?.classList.contains('show')) start();
})();

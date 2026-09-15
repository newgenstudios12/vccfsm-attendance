(() => {
'use strict';
if (window.__VCCF_ID_INTERACTIONS_V1__) return;
window.__VCCF_ID_INTERACTIONS_V1__ = true;

if (!document.querySelector('script[data-vccf-ux-5-9-11-loader]')) {
  const ux = document.createElement('script');
  ux.src = '/vccf-ux-5-9-11.js?v=20260915-1';
  ux.defer = true;
  ux.dataset.vccfUx5911Loader = '1';
  document.head.appendChild(ux);
}

let expandedShell = null;
let closeButton = null;
let floatingButton = null;
let quickPanel = null;
let quickLoading = false;

function closeExpanded() {
  if (expandedShell?.isConnected) expandedShell.classList.remove('id-card-expanded');
  expandedShell = null;
  closeButton?.remove();
  closeButton = null;
  document.documentElement.classList.remove('id-card-expanded-open');
}

function openExpanded(shell) {
  if (!shell?.isConnected) return;
  closeExpanded();
  expandedShell = shell;
  shell.classList.add('id-card-expanded');
  document.documentElement.classList.add('id-card-expanded-open');
  closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'id-card-expand-close';
  closeButton.setAttribute('aria-label','Close enlarged Digital ID');
  closeButton.textContent = '×';
  document.body.appendChild(closeButton);
  closeButton.addEventListener('click', closeExpanded, {once:true});
  requestAnimationFrame(() => closeButton?.focus());
}

function isSignedIn() {
  return !!window.VCCF?.getState?.()?.session?.user?.id;
}

function quickOpen() {
  return !!quickPanel?.classList.contains('open');
}

function updateFloatingButton() {
  if (!floatingButton?.isConnected) return;
  const signedIn = isSignedIn();
  const appVisible = document.getElementById('app')?.classList.contains('show');
  floatingButton.hidden = !(signedIn && appVisible);
  const open = quickOpen();
  floatingButton.classList.toggle('is-current', open);
  floatingButton.setAttribute('aria-expanded', String(open));
  floatingButton.setAttribute('aria-label', open ? 'Hide Digital ID' : 'Show Digital ID');
  floatingButton.title = open ? 'Hide Digital ID' : 'Show Digital ID';
  const label = floatingButton.querySelector('.vccf-floating-id-label');
  if (label) label.textContent = open ? 'Hide ID' : 'Digital ID';
}

function ensureQuickPanel() {
  if (quickPanel?.isConnected) return quickPanel;
  quickPanel = document.getElementById('vccfQuickDigitalId');
  if (!quickPanel) {
    quickPanel = document.createElement('div');
    quickPanel.id = 'vccfQuickDigitalId';
    quickPanel.className = 'vccf-quick-id-panel';
    quickPanel.setAttribute('role','dialog');
    quickPanel.setAttribute('aria-label','Digital ID quick view');
    quickPanel.setAttribute('aria-hidden','true');
    quickPanel.innerHTML = '<div class="vccf-quick-id-card" data-quick-id-card></div>';
    document.body.appendChild(quickPanel);
  }
  return quickPanel;
}

function closeQuickId() {
  if (!quickPanel?.isConnected) return;
  quickPanel.classList.remove('open');
  quickPanel.setAttribute('aria-hidden','true');
  updateFloatingButton();
}

async function openQuickId() {
  const panel = ensureQuickPanel();
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  updateFloatingButton();
  if (quickLoading) return;
  const card = panel.querySelector('[data-quick-id-card]');
  if (!card) return;
  quickLoading = true;
  try {
    await window.VCCFMemberIds?.mountCardOnly?.(card);
  } finally {
    quickLoading = false;
  }
}

function toggleQuickId() {
  if (quickOpen()) closeQuickId();
  else void openQuickId();
}

function ensureFloatingButton() {
  if (floatingButton?.isConnected) {
    updateFloatingButton();
    return floatingButton;
  }
  floatingButton = document.getElementById('vccfFloatingDigitalId');
  if (!floatingButton) {
    floatingButton = document.createElement('button');
    floatingButton.id = 'vccfFloatingDigitalId';
    floatingButton.type = 'button';
    floatingButton.className = 'vccf-floating-digital-id';
    floatingButton.setAttribute('aria-controls','vccfQuickDigitalId');
    floatingButton.setAttribute('aria-expanded','false');
    floatingButton.setAttribute('aria-label','Show Digital ID');
    floatingButton.innerHTML = '<span class="vccf-floating-id-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2.1"/><path d="M5.5 16c.7-1.7 1.6-2.5 2.5-2.5s1.8.8 2.5 2.5M13 9h5M13 12h5M13 15h3.5"/></svg></span><span class="vccf-floating-id-label">Digital ID</span>';
    floatingButton.addEventListener('click', toggleQuickId);
    document.body.appendChild(floatingButton);
  }
  ensureQuickPanel();
  updateFloatingButton();
  return floatingButton;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly','');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function addButton(actions, className, icon, text, before) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn secondary ${className}`;
  button.innerHTML = `<span class="id-action-icon" aria-hidden="true">${icon}</span>${text}`;
  before ? actions.insertBefore(button,before) : actions.appendChild(button);
  return button;
}

function enhanceActions(root) {
  const actions = root.querySelector('.id-card-actions');
  const shell = root.querySelector('.id-card-shell');
  if (!actions || !shell || actions.dataset.idInteractionEnhanced === '1') return;
  actions.dataset.idInteractionEnhanced = '1';
  actions.classList.add('id-actions-enhanced');
  shell.dataset.idInteractive = '1';
  shell.tabIndex = 0;
  shell.setAttribute('role','button');
  shell.setAttribute('aria-label','Enlarge Digital ID');

  const first = actions.firstElementChild;
  const expand = addButton(actions,'id-expand-btn','⛶','Enlarge',first);
  const copy = addButton(actions,'id-copy-number','#','Copy member no.',first);

  expand.addEventListener('click',() => openExpanded(shell));
  copy.addEventListener('click',async() => {
    const value = root.querySelector('.id-card-number .id-number')?.textContent?.trim();
    if (!value || value === 'Not assigned') return;
    const original = copy.innerHTML;
    try {
      await copyText(value);
      copy.classList.add('copied');
      copy.innerHTML = '<span class="id-action-icon" aria-hidden="true">✓</span>Copied';
      setTimeout(() => { if(copy.isConnected){copy.classList.remove('copied');copy.innerHTML=original;} },1500);
    } catch (_) {
      copy.textContent = 'Copy failed';
      setTimeout(() => { if(copy.isConnected) copy.innerHTML=original; },1500);
    }
  });

  shell.addEventListener('click',event => {
    if (shell.classList.contains('id-card-expanded')) {
      if (event.target === shell) closeExpanded();
      return;
    }
    if (event.target.closest('.id-card')) openExpanded(shell);
  });
  shell.addEventListener('keydown',event => {
    if ((event.key === 'Enter' || event.key === ' ') && !shell.classList.contains('id-card-expanded')) {
      event.preventDefault();
      openExpanded(shell);
    }
  });

  const note = document.createElement('p');
  note.className = 'id-interaction-note';
  note.innerHTML = '<span aria-hidden="true">↗</span><span>Tap the ID or choose <b>Enlarge</b> for a closer view. Your QR code remains ready for attendance scanning.</span>';
  const exportFeedback = root.querySelector('[data-id-export-feedback]');
  if (exportFeedback) exportFeedback.insertAdjacentElement('afterend',note);
}

function enhanceRequestProgress(root) {
  const current = root.querySelector('.id-current-request');
  if (!current || current.querySelector('.id-request-progress')) return;
  const badge = current.querySelector('.id-badge');
  if (!badge) return;
  const text = badge.textContent.trim().toLowerCase();
  const status = text.includes('printing') ? 'printing' : text.includes('ready') ? 'ready' : 'pending';
  const order = ['pending','printing','ready'];
  const currentIndex = order.indexOf(status);
  const labels = ['Requested','Preparing','Ready'];
  const progress = document.createElement('div');
  progress.className = 'id-request-progress';
  progress.setAttribute('aria-label',`Physical ID request status: ${badge.textContent.trim()}`);
  progress.innerHTML = order.map((key,index) => `<div class="id-request-step ${index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}">${labels[index]}</div>`).join('');
  badge.insertAdjacentElement('afterend',progress);
  const hint = document.createElement('p');
  hint.className = 'id-request-status-copy';
  hint.textContent = status === 'ready' ? 'Final step reached — your physical ID is ready for pickup.' : status === 'printing' ? 'Your request is approved and the physical ID is being prepared.' : 'Your request was received and is waiting to be prepared.';
  progress.insertAdjacentElement('afterend',hint);
}

function enhance() {
  ensureFloatingButton();
  const root = document.getElementById('memberIdView') || document.querySelector('.view.active [data-member-id-root]') || document.querySelector('.view.active .id-layout')?.closest('.view');
  if (!root) {
    if (expandedShell && !expandedShell.isConnected) closeExpanded();
    updateFloatingButton();
    return;
  }
  enhanceActions(root);
  enhanceRequestProgress(root);
  if (expandedShell && !expandedShell.isConnected) closeExpanded();
  updateFloatingButton();
}

const observer = new MutationObserver(() => requestAnimationFrame(enhance));
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('keydown',event => {
  if (event.key !== 'Escape') return;
  if (expandedShell) { event.preventDefault(); closeExpanded(); return; }
  if (quickOpen()) { event.preventDefault(); closeQuickId(); }
});
window.addEventListener('vccf-signed-out',() => { closeExpanded(); closeQuickId(); updateFloatingButton(); });
window.addEventListener('vccf-id-template-updated',() => { if (quickOpen()) void openQuickId(); setTimeout(enhance,100); });
window.addEventListener('vccf-profile-photo-updated',() => { if (quickOpen()) void openQuickId(); setTimeout(enhance,100); });
window.addEventListener('vccf-member-updated',() => { if (quickOpen()) void openQuickId(); });
window.addEventListener('vccf-member-contact-updated',() => { if (quickOpen()) void openQuickId(); });
window.addEventListener('vccf-app-ready',() => setTimeout(enhance,250));
window.addEventListener('focus',updateFloatingButton);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => setTimeout(enhance,500),{once:true});
else setTimeout(enhance,500);
})();

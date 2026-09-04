(() => {
'use strict';
if (window.__VCCF_FINANCE_NAV__) return;
window.__VCCF_FINANCE_NAV__ = true;

const ROUTES = ['pledges','giving','bandfund'];
const LABELS = {pledges:'Pledges',giving:'Tithes & Offerings',bandfund:'Band Funds'};
const financeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h17v11h-17z"/><path d="M6.5 7.5V5.5h11v2M7.5 12h9M7.5 15h5"/></svg>';
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
let syncing = false;
let observer = null;
let loadAttempted = false;

function ensureBandFundModule(){
  if (window.__VCCF_BAND_FUND__ || document.querySelector('script[src*="vccf-band-fund.js"]') || loadAttempted) return;
  loadAttempted = true;
  const s = document.createElement('script');
  s.src = '/vccf-band-fund.js?v=20260904-2';
  s.defer = true;
  document.head.appendChild(s);
}

function normalizeChild(button){
  if (!button) return;
  button.classList.add('nav-child');
  const icon = button.querySelector('.nav-icon');
  if (icon) icon.remove();
  const label = button.querySelector('.nav-label');
  if (label && LABELS[button.dataset.route]) label.textContent = LABELS[button.dataset.route];
}

function makeGroup(nav, anchor){
  const group = document.createElement('div');
  group.className = 'nav-group';
  group.id = 'financeNavGroup';
  group.innerHTML = '<button class="nav-group-toggle" type="button" aria-expanded="false"><span class="nav-icon">'+financeIcon+'</span><span class="nav-label">Finance</span><span class="nav-chevron">'+chevron+'</span></button><div class="nav-children"><div class="nav-children-inner"></div></div>';
  if (anchor?.parentNode === nav) nav.insertBefore(group, anchor);
  else nav.appendChild(group);
  const toggle = group.querySelector('.nav-group-toggle');
  toggle.addEventListener('click', () => {
    const open = group.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  return group;
}

function syncActive(group){
  if (!group) return;
  const active = ROUTES.some(route => group.querySelector('[data-route="'+route+'"]')?.classList.contains('active'));
  const toggle = group.querySelector('.nav-group-toggle');
  toggle?.classList.toggle('active', active);
  if (active) {
    group.classList.add('open');
    toggle?.setAttribute('aria-expanded','true');
  }
}

function organize(){
  if (syncing) return;
  syncing = true;
  try {
    const nav = document.querySelector('.sidebar .nav');
    if (!nav) return;
    let group = nav.querySelector('#financeNavGroup');
    const buttons = ROUTES.map(route => nav.querySelector('[data-route="'+route+'"]')).filter(Boolean);
    if (!buttons.length) return;

    if (!group) {
      const churchGroup = nav.querySelector('#churchNavGroup');
      const moreLabel = Array.from(nav.children).find(el => el.classList?.contains('nav-section-label') && el.textContent.trim() === 'More');
      const anchor = moreLabel || churchGroup?.nextElementSibling || buttons[0];
      group = makeGroup(nav, anchor);
    }
    const inner = group.querySelector('.nav-children-inner');
    ROUTES.forEach(route => {
      const button = nav.querySelector('[data-route="'+route+'"]');
      if (!button || button.closest('#financeNavGroup') === group) {
        if (button) normalizeChild(button);
        return;
      }
      normalizeChild(button);
      inner.appendChild(button);
    });
    syncActive(group);
  } finally {
    syncing = false;
  }
}

function start(){
  ensureBandFundModule();
  organize();
  if (observer) return;
  observer = new MutationObserver(() => {
    organize();
    syncActive(document.getElementById('financeNavGroup'));
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click', e => {
    if (e.target.closest('[data-route]')) setTimeout(() => syncActive(document.getElementById('financeNavGroup')),0);
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
else start();
window.addEventListener('vccf-app-ready', () => { ensureBandFundModule(); organize(); });
window.addEventListener('vccf-signed-out', () => setTimeout(organize,0));
})();

(() => {
'use strict';
if (window.__VCCF_MEMBERS_ADD_LOADER_V5__) return;
window.__VCCF_MEMBERS_ADD_LOADER_V5__ = true;

let loading = null;
let loaded = false;

const authenticated = () => {
  const s = window.VCCF?.getState?.();
  return !!(s?.session?.user && window.VCCF?.sb && document.getElementById('app')?.classList.contains('show'));
};

function ensureStyles() {
  if (document.querySelector('link[data-vccf-members-add-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/vccf-members-add.css?v=20260905-3';
  link.dataset.vccfMembersAddStyle = '1';
  document.head.appendChild(link);
}

function activate() {
  if (loaded) window.dispatchEvent(new CustomEvent('vccf-members-add-activate'));
}

function loadModule() {
  if (!authenticated()) return Promise.resolve(false);
  if (loaded) { activate(); return Promise.resolve(true); }
  if (loading) return loading;
  ensureStyles();
  loading = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = '/vccf-members-add.js?v=20260905-4';
    script.dataset.vccfMembersAddModule = '1';
    script.onload = () => { loaded = true; loading = null; activate(); resolve(true); };
    script.onerror = () => { loading = null; console.error('Add Member module failed to load. The rest of VCCF Connect remains available.'); resolve(false); };
    document.head.appendChild(script);
  });
  return loading;
}

function loadForMembersView() {
  setTimeout(() => {
    if (!authenticated()) return;
    if (!document.getElementById('members')?.classList.contains('active')) return;
    loadModule();
  }, 0);
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-view="members"], [data-route="members"]')) loadForMembersView();
}, true);
window.addEventListener('vccf-app-ready', loadForMembersView);
window.addEventListener('focus', loadForMembersView);
window.addEventListener('popstate', loadForMembersView);
window.addEventListener('vccf-signed-out', () => {
  document.getElementById('vccfMemberModal')?.remove();
});
loadForMembersView();
})();

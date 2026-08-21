/* VCCF: remove the duplicate My Profile navigation entry while preserving profile access elsewhere. */
(function () {
  'use strict';
  function isDuplicateMyProfile(el) {
    if (!el || !el.closest) return false;
    var nav = el.closest('.sidebar .nav, .nav');
    if (!nav) return false;
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
    var view = String(el.getAttribute('data-view') || '').toLowerCase();
    var href = String(el.getAttribute('href') || '').toLowerCase();
    return view === 'profile' || view === 'my-profile' || href === '#profile' || href.indexOf('my-profile') !== -1 || text === 'my profile';
  }
  function hideMyProfile() {
    document.querySelectorAll('.sidebar .nav button, .sidebar .nav a, .nav button, .nav a').forEach(function (el) {
      if (isDuplicateMyProfile(el)) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideMyProfile, { once: true });
  else hideMyProfile();
  new MutationObserver(hideMyProfile).observe(document.documentElement, { childList: true, subtree: true });
})();

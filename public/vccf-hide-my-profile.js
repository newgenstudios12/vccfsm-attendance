/* VCCF: intentionally hide the retired My Profile navigation item. */
(function () {
  'use strict';
  function hideMyProfile() {
    var selectors = [
      '.nav button[data-view="profile"]',
      '.nav button[data-view="my-profile"]',
      '.nav a[data-view="profile"]',
      '.nav a[data-view="my-profile"]',
      '.nav a[href="#profile"]',
      '.nav a[href*="my-profile"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideMyProfile, { once: true });
  } else {
    hideMyProfile();
  }
  new MutationObserver(hideMyProfile).observe(document.documentElement, { childList: true, subtree: true });
})();

/* VCCF: safely hide only explicit legacy My Profile navigation items. */
(function () {
  'use strict';
  function hideMyProfile() {
    var selectors = [
      '.sidebar .nav button[data-view="profile"]',
      '.sidebar .nav button[data-view="my-profile"]',
      '.sidebar .nav a[data-view="profile"]',
      '.sidebar .nav a[data-view="my-profile"]',
      '.sidebar .nav a[href="#profile"]',
      '.sidebar .nav a[href*="my-profile"]'
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
})();

/* VCCF: hide the retired My Profile navigation item without observing the document. */
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

  function boot() {
    hideMyProfile();
    window.requestAnimationFrame(hideMyProfile);
    setTimeout(hideMyProfile, 0);
    setTimeout(hideMyProfile, 250);
    setTimeout(hideMyProfile, 700);
    window.addEventListener('vccf-app-ready', hideMyProfile, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

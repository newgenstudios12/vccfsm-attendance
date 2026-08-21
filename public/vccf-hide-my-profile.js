/* VCCF: keep the first My Profile navigation entry and remove only duplicates. */
(function () {
  'use strict';

  function removeDuplicateMyProfile() {
    var navItems = Array.prototype.slice.call(
      document.querySelectorAll('.sidebar .nav button, .sidebar .nav a')
    );
    var matches = navItems.filter(function (el) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return text === 'my profile';
    });

    /* Preserve the first/original item and remove every later duplicate. */
    matches.slice(1).forEach(function (el) {
      el.remove();
    });
  }

  function run() {
    removeDuplicateMyProfile();
    /* Some navigation items are inserted after initial page setup. */
    window.setTimeout(removeDuplicateMyProfile, 300);
    window.setTimeout(removeDuplicateMyProfile, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

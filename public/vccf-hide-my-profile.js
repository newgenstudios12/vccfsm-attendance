/* VCCF: keep one My Profile entry without removing live navigation nodes. */
(function () {
  'use strict';

  function stabilizeMyProfile() {
    var navItems = Array.prototype.slice.call(
      document.querySelectorAll('.sidebar .nav button, .sidebar .nav a')
    );
    var matches = navItems.filter(function (el) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return text === 'my profile';
    });

    /* Keep the first entry. Hide later duplicates instead of removing DOM nodes,
       so other navigation scripts cannot lose references to their controls. */
    matches.forEach(function (el, index) {
      var duplicate = index > 0;
      el.hidden = duplicate;
      el.setAttribute('aria-hidden', duplicate ? 'true' : 'false');
      if (duplicate) el.style.display = 'none';
      else el.style.removeProperty('display');
    });
  }

  function run() {
    stabilizeMyProfile();
    window.setTimeout(stabilizeMyProfile, 300);
    window.setTimeout(stabilizeMyProfile, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

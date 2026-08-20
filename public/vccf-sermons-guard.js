(() => {
  'use strict';
  if (window.__VCCF_SERMONS_GUARD__) return;
  window.__VCCF_SERMONS_GUARD__ = true;

  const SERMON_ID = 'vccf-sermons-view';

  function cleanup() {
    const sermon = document.getElementById(SERMON_ID);
    if (!sermon) return;

    // The app has one canonical active page. If any other page is active,
    // Sermons must not remain mounted beside it.
    const activeOther = Array.from(document.querySelectorAll('.view.active'))
      .some(v => v.id !== SERMON_ID);
    if (activeOther) {
      sermon.remove();
      return;
    }

    // Defensive cleanup for layouts that do not use .view.active consistently.
    const navSermon = document.querySelector('.nav [data-view="sermons"]');
    const title = document.getElementById('pageTitle');
    if (title && title.textContent.trim() !== 'Sermons' && navSermon && !navSermon.classList.contains('active')) {
      sermon.remove();
    }
  }

  function schedule() {
    requestAnimationFrame(cleanup);
    setTimeout(cleanup, 0);
    setTimeout(cleanup, 50);
    setTimeout(cleanup, 250);
  }

  // Capture clicks before the app's own navigation handler. Any navigation
  // other than Sermons immediately tears down the Sermons view.
  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-view], a[href^="#"]');
    if (!target) return;
    const view = target.dataset?.view;
    if (view !== 'sermons') schedule();
  }, true);

  // Covers quick actions, programmatic route changes, and dynamically-created
  // navigation buttons that do not emit a click event we can reliably observe.
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});

  // Final safety net for application code that changes active classes directly.
  window.setInterval(cleanup, 500);
  schedule();
})();
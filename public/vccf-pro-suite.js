(()=>{'use strict';
// VCCF Pro Suite safety shim.
// The previous implementation attached a document-wide MutationObserver that
// responded to its own DOM writes, creating an endless refresh/mutation cycle
// after login and making the page appear frozen. Core app navigation, login,
// attendance, members, chat, gallery, sermons and profile modules remain intact.
window.__VCCF_PRO_SUITE_V2__=true;
window.__VCCF_PRO_SUITE_DISABLED__=true;
})();

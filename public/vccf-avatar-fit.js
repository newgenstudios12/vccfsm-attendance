(() => {
  'use strict';
  if (window.__VCCF_AVATAR_FIT_V1__) return;
  window.__VCCF_AVATAR_FIT_V1__ = true;

  const css = `
    .userchip .avatar,
    .topbar .avatar,
    .vccf-account-avatar {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      border-radius: 50% !important;
      overflow: hidden !important;
      padding: 0 !important;
      line-height: 0 !important;
      flex: 0 0 44px !important;
      display: grid !important;
      place-items: center !important;
    }
    .userchip .avatar img,
    .topbar .avatar img,
    .vccf-account-avatar img {
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      display: block !important;
      object-fit: cover !important;
      object-position: center center !important;
      border-radius: 50% !important;
      margin: 0 !important;
      padding: 0 !important;
      aspect-ratio: 1 / 1 !important;
    }
    @media (max-width:700px) {
      .userchip .avatar,
      .topbar .avatar,
      .vccf-account-avatar {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        flex-basis: 40px !important;
      }
    }
  `;

  const apply = () => {
    if (!document.getElementById('vccf-avatar-fit-style')) {
      const style = document.createElement('style');
      style.id = 'vccf-avatar-fit-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
    document.querySelectorAll('.userchip .avatar img, .topbar .avatar img, .vccf-account-avatar img').forEach(img => {
      img.style.setProperty('object-fit', 'cover', 'important');
      img.style.setProperty('object-position', 'center center', 'important');
      img.style.setProperty('width', '100%', 'important');
      img.style.setProperty('height', '100%', 'important');
    });
  };

  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('vccf-app-ready', () => setTimeout(apply, 100));
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();

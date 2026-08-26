(() => {
  'use strict';
  if (window.__VCCF_AVATAR_FIT_V2__) return;
  window.__VCCF_AVATAR_FIT_V2__ = true;

  const css = `
    .userchip .avatar,
    .topbar .avatar,
    .vccf-account-avatar,
    .userchip img.avatar,
    .topbar img.avatar,
    img.vccf-account-avatar {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      min-height: 44px !important;
      max-width: 44px !important;
      max-height: 44px !important;
      aspect-ratio: 1 / 1 !important;
      border-radius: 50% !important;
      overflow: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
      line-height: 0 !important;
      flex: 0 0 44px !important;
      align-self: center !important;
      display: block !important;
      object-fit: cover !important;
      object-position: center center !important;
    }

    .userchip .avatar img,
    .topbar .avatar img,
    .vccf-account-avatar img {
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: none !important;
      max-height: none !important;
      aspect-ratio: 1 / 1 !important;
      display: block !important;
      object-fit: cover !important;
      object-position: center center !important;
      border-radius: 50% !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    @media (max-width:700px) {
      .userchip .avatar,
      .topbar .avatar,
      .vccf-account-avatar,
      .userchip img.avatar,
      .topbar img.avatar,
      img.vccf-account-avatar {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        max-width: 40px !important;
        max-height: 40px !important;
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

    document.querySelectorAll(
      '.userchip .avatar, .topbar .avatar, .vccf-account-avatar, .userchip img.avatar, .topbar img.avatar, img.vccf-account-avatar'
    ).forEach(el => {
      el.style.setProperty('width', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('height', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('min-width', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('min-height', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('max-width', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('max-height', window.innerWidth <= 700 ? '40px' : '44px', 'important');
      el.style.setProperty('aspect-ratio', '1 / 1', 'important');
      el.style.setProperty('border-radius', '50%', 'important');
      el.style.setProperty('object-fit', 'cover', 'important');
      el.style.setProperty('object-position', 'center center', 'important');
      el.style.setProperty('align-self', 'center', 'important');
      el.style.setProperty('flex', window.innerWidth <= 700 ? '0 0 40px' : '0 0 44px', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    });
  };

  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('vccf-app-ready', () => setTimeout(apply, 100));
  window.addEventListener('resize', apply);
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();

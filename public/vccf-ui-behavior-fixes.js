(() => {
  'use strict';
  if (window.__VCCF_UI_BEHAVIOR_FIXES__) return;
  window.__VCCF_UI_BEHAVIOR_FIXES__ = true;

  const css = `
    /* Chat: keep the inbox/list fixed; only the active conversation scrolls. */
    .chat-shell{min-height:0;overflow:hidden}
    .chat-inbox,.chat-thread{min-height:0}
    .chat-list{overflow:hidden;min-height:0}
    .chat-messages{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
    .chat-thread{overflow:hidden}
    @media(max-width:820px){
      .chat-shell{min-height:0;overflow:hidden}
      .chat-messages{min-height:0}
    }

    /* Sermon upload: persistent modal, independent of the current page/view. */
    #vccf-sermon-upload-modal{position:fixed;inset:0;z-index:1000;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.58)}
    #vccf-sermon-upload-modal.open{display:grid}
    #vccf-sermon-upload-modal .vccf-sermon-upload-card{width:min(680px,100%);max-height:min(90vh,760px);overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.24)}
    #vccf-sermon-upload-modal .vccf-sermon-upload-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
    #vccf-sermon-upload-modal .vccf-sermon-upload-head h3{margin:0}
    #vccf-sermon-upload-modal .vccf-sermon-upload-close{width:36px;height:36px;border:0;border-radius:50%;background:var(--bg);color:var(--text);font-size:1.25rem}
    #vccf-sermon-upload-modal .sermon-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #vccf-sermon-upload-modal .sermon-form .full{grid-column:1/-1}
    #vccf-sermon-upload-modal .sermon-form input,#vccf-sermon-upload-modal .sermon-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:11px;padding:11px;background:var(--bg);color:var(--text)}
    #vccf-sermon-upload-modal .sermon-form textarea{min-height:100px;resize:vertical}
    #vccf-sermon-upload-modal .sermon-form button{border:0;border-radius:11px;padding:11px 16px;background:var(--brand-gradient);color:#fff;font-weight:800;cursor:pointer}
    #vccf-sermon-upload-modal .sermon-form button:disabled{opacity:.65;cursor:wait}
    @media(max-width:700px){#vccf-sermon-upload-modal{padding:12px}#vccf-sermon-upload-modal .vccf-sermon-upload-card{border-radius:18px;padding:16px}#vccf-sermon-upload-modal .sermon-form{grid-template-columns:1fr}#vccf-sermon-upload-modal .sermon-form .full{grid-column:auto}}
  `;
  const style = document.createElement('style');
  style.id = 'vccf-ui-behavior-fixes-style';
  style.textContent = css;
  document.head.appendChild(style);

  function modal() {
    let el = document.getElementById('vccf-sermon-upload-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'vccf-sermon-upload-modal';
    el.innerHTML = `
      <div class="vccf-sermon-upload-card" role="dialog" aria-modal="true" aria-labelledby="vccf-sermon-upload-title">
        <div class="vccf-sermon-upload-head">
          <div><h3 id="vccf-sermon-upload-title">Upload Sermon</h3><p style="margin:4px 0 0;color:var(--muted);font-size:.82rem">Upload a sermon file without leaving your current page.</p></div>
          <button type="button" class="vccf-sermon-upload-close" aria-label="Close">×</button>
        </div>
        <div data-sermon-form-mount></div>
      </div>`;
    document.body.appendChild(el);
    const close = () => el.classList.remove('open');
    el.querySelector('.vccf-sermon-upload-close').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return el;
  }

  function wireForm(form) {
    if (!form || form.dataset.vccfPersistentUpload === '1') return;
    const m = modal();
    m.querySelector('[data-sermon-form-mount]').appendChild(form);
    form.dataset.vccfPersistentUpload = '1';

    const admin = document.getElementById('vccf-sermon-admin');
    if (admin) {
      admin.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div><strong>Admin: Sermon Upload</strong><div style="color:var(--muted);font-size:.82rem;margin-top:4px">The upload window stays open while you navigate between pages.</div></div>
          <button type="button" class="btn" data-open-sermon-upload>+ Upload Sermon</button>
        </div>`;
      const open = admin.querySelector('[data-open-sermon-upload]');
      if (open) open.addEventListener('click', () => m.classList.add('open'));
    }
  }

  function scan() {
    const form = document.getElementById('vccf-sermon-form');
    if (form) wireForm(form);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.body, {childList:true, subtree:true});
  scan();
})();

(() => {
  'use strict';
  if (window.__VCCF_UI_BEHAVIOR_FIXES__) return;
  window.__VCCF_UI_BEHAVIOR_FIXES__ = true;

  const css = `
    .main{min-height:100vh}
    #chat.view.active{display:flex;flex-direction:column;min-height:calc(100dvh - 52px)}
    #chat.view.active > .toolbar{flex:0 0 auto}
    #chat.view.active .chat-shell{flex:1 1 auto;min-height:0;height:auto;max-height:none;overflow:hidden}
    .chat-shell{grid-template-columns:minmax(280px,320px) minmax(0,1fr);background:var(--panel)}
    .chat-inbox,.chat-thread{min-height:0}
    .chat-inbox{background:var(--panel)}
    .chat-inbox-head{flex:0 0 auto}
    .chat-list{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
    .chat-thread{overflow:hidden;display:flex;flex-direction:column;background:var(--bg)}
    .chat-thread-head{flex:0 0 auto;position:relative;z-index:2;min-height:68px}
    .chat-messages{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:22px 24px}
    .chat-composer{flex:0 0 auto;position:relative;z-index:2}
    .chat-bubble{max-width:min(74%,680px)}
    @media(max-width:820px){
      #chat.view.active{min-height:calc(100dvh - 30px)}
      #chat.view.active .chat-shell{grid-template-columns:1fr}
      .chat-shell{min-height:0;overflow:hidden}
      .chat-inbox{min-height:0}
      .chat-shell.thread-open .chat-inbox{display:none}
      .chat-shell.thread-open .chat-thread{display:flex}
      .chat-messages{padding:16px}
      .chat-bubble{max-width:86%}
    }
    @media(max-width:600px){
      #chat.view.active{min-height:calc(100dvh - 20px)}
      .chat-shell{border-radius:16px}
      .chat-inbox-head{padding:14px}
      .chat-composer{padding:10px}
    }

    /* Sermons: gallery-style page cards; no floating upload/download surface. */
    #vccf-sermon-upload-modal{display:none!important;pointer-events:none!important}
    #vccf-sermons-view .sermon-list{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;align-items:stretch}
    #vccf-sermons-view .sermon-card{height:100%;flex-direction:column;align-items:stretch;gap:12px;border-radius:18px;padding:0;overflow:hidden;background:var(--panel);box-shadow:0 8px 24px rgba(16,24,40,.06)}
    #vccf-sermons-view .sermon-card::before{content:"";display:block;height:6px;background:var(--brand-gradient)}
    #vccf-sermons-view .sermon-card .sermon-icon{margin:4px 16px 0;width:52px;height:52px;border-radius:14px}
    #vccf-sermons-view .sermon-card .sermon-info{padding:0 16px;min-height:92px}
    #vccf-sermons-view .sermon-card .sermon-info strong{font-size:1rem;white-space:normal;line-height:1.35}
    #vccf-sermons-view .sermon-card .sermon-actions{padding:0 16px 16px;width:100%}
    #vccf-sermons-view .sermon-card .sermon-actions button{flex:1;min-height:40px}
    #vccf-sermons-view .sermon-card .sermon-actions button.danger{flex:0 0 auto}
    @media(max-width:700px){#vccf-sermons-view .sermon-list{grid-template-columns:1fr}}
  `;
  const style=document.createElement('style');
  style.id='vccf-ui-behavior-fixes-style';
  style.textContent=css;
  document.head.appendChild(style);

  const cleanup=()=>document.getElementById('vccf-sermon-upload-modal')?.remove();
  cleanup();
  new MutationObserver(cleanup).observe(document.body,{childList:true,subtree:true});
})();

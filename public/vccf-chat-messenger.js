(()=>{
'use strict';
if(window.__VCCF_CHAT_MESSENGER__)return;
window.__VCCF_CHAT_MESSENGER__=true;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const css=`
/* Messenger-style refinement layer */
.chat-shell{background:var(--panel);box-shadow:0 18px 45px rgba(16,24,40,.08)}
.chat-inbox-head{padding:16px 14px 12px}
.chat-inbox-head h3{font-size:1.05rem;letter-spacing:-.01em}
.chat-search{height:42px;border-radius:21px;padding:9px 15px;background:color-mix(in srgb,var(--bg) 94%,var(--panel));}
.chat-row{position:relative;gap:12px;padding:11px 14px;border-bottom:0;border-radius:12px;margin:2px 7px;width:calc(100% - 14px);}
.chat-row:hover{background:color-mix(in srgb,var(--brand-gradient) 7%,transparent)}
.chat-row.active{background:color-mix(in srgb,var(--brand-gradient) 10%,transparent)}
.chat-row.active::before{content:"";position:absolute;left:-1px;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--brand-gradient)}
.chat-avatar{box-shadow:0 0 0 2px var(--panel);}
.chat-avatar.sm{width:44px;height:44px}
.chat-row-top{align-items:center}
.chat-preview{font-size:.78rem;max-width:100%}
.chat-unread{background:var(--brand-gradient);margin-left:7px;vertical-align:middle}
.chat-thread{background:var(--bg)}
.chat-thread-head{min-height:70px;padding:12px 18px;box-shadow:0 1px 0 var(--line)}
.chat-thread-head b{font-size:.92rem}
.chat-thread-head small{font-size:.72rem}
.chat-messages{padding:20px 20px 14px;gap:3px;scroll-behavior:smooth}
.chat-bubble-row{margin-top:5px}
.chat-bubble-row.grouped{margin-top:1px}
.chat-bubble{padding:9px 12px;border-radius:18px;box-shadow:0 1px 1px rgba(0,0,0,.035)}
.chat-bubble.mine{border-bottom-right-radius:5px}
.chat-bubble.theirs{border-bottom-left-radius:5px}
.chat-meta{font-size:.62rem;margin-top:2px;opacity:.72}
.chat-composer{align-items:flex-end;padding:11px 14px;background:var(--panel);gap:8px}
.chat-composer textarea{min-height:42px;border-radius:21px;padding:10px 15px;line-height:1.35}
.chat-composer button{width:42px;height:42px;padding:0;border-radius:50%;font-size:0;display:grid;place-items:center}
.chat-composer button::after{content:"➤";font-size:1rem;line-height:1}
.chat-new-results{border-radius:16px}
.chat-empty{min-height:100%;}
.chat-mobile-back{font-size:1.5rem;line-height:1}
.vccf-date-divider{display:flex;align-items:center;gap:10px;justify-content:center;margin:14px 0 8px;color:var(--muted);font-size:.66rem;font-weight:700}
.vccf-date-divider::before,.vccf-date-divider::after{content:"";height:1px;flex:1;background:var(--line)}
.vccf-sent-status{font-size:.6rem;color:var(--muted);text-align:right;margin:1px 5px 0}
.vccf-online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22a06b;margin-right:6px;box-shadow:0 0 0 2px var(--panel)}
@media(max-width:820px){.chat-shell{height:calc(100vh - 118px)}.chat-messages{padding:16px 13px 12px}.chat-thread-head{padding:10px 12px}.chat-composer{padding:9px 10px}}
`;
function addCss(){if($('#vccf-chat-messenger-style'))return;const s=document.createElement('style');s.id='vccf-chat-messenger-style';s.textContent=css;document.head.appendChild(s)}
function toDateKey(ts){const d=new Date(ts);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
function dateLabel(ts){const d=new Date(ts),today=new Date();const y=new Date(today);y.setDate(today.getDate()-1);if(d.toDateString()===today.toDateString())return 'Today';if(d.toDateString()===y.toDateString())return 'Yesterday';return d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}
function decorate(){
 const box=$('#vccfChatMessages'); if(!box)return;
 const rows=$$('.chat-bubble-row',box); let lastMine=null,lastDate=null;
 rows.forEach((row,i)=>{
   const bubble=$('.chat-bubble',row); const meta=$('.chat-meta',row); if(!bubble||!meta)return;
   const mine=bubble.classList.contains('mine');
   const ts=meta.textContent||'';
   if(i>0){const prev=rows[i-1], prevBubble=$('.chat-bubble',prev); if(prevBubble&&prevBubble.classList.contains(mine?'mine':'theirs'))row.classList.add('grouped')}
   if(!row.dataset.vccfDecoratedDate && bubble.dataset.createdAt){
     const key=toDateKey(bubble.dataset.createdAt);
     if(key!==lastDate){const divider=document.createElement('div');divider.className='vccf-date-divider';divider.textContent=dateLabel(bubble.dataset.createdAt);box.insertBefore(divider,row);lastDate=key} }
   lastMine=mine; row.dataset.vccfMessenger='1';
   if(mine&&!row.nextElementSibling?.classList.contains('vccf-sent-status')){
     const status=document.createElement('div');status.className='vccf-sent-status';status.textContent='Sent';row.after(status);
   }
 });
}
function patchAppender(){
 const original=window.__VCCF_CHAT_V2_PATCHED_APPEND__;
 if(original||!window.__VCCF_CHAT_V2__)return;
 // decorate after each render cycle without changing the existing data flow
 const obs=new MutationObserver(()=>requestAnimationFrame(decorate));
 const box=$('#vccfChatMessages'); if(box)obs.observe(box,{childList:true,subtree:true});
 window.__VCCF_CHAT_V2_PATCHED_APPEND__=true;
}
function bindComposer(){
 const input=$('#vccfChatInput'); if(!input||input.dataset.messengerBound)return;input.dataset.messengerBound='1';
 input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,130)+'px'});
 input.addEventListener('focus',()=>setTimeout(()=>{const box=$('#vccfChatMessages');if(box)box.scrollTop=box.scrollHeight},60));
}
function observe(){
 addCss();bindComposer();patchAppender();decorate();
 const root=document.body;
 const obs=new MutationObserver(()=>{addCss();bindComposer();patchAppender();decorate()});
 obs.observe(root,{childList:true,subtree:true});
 setTimeout(()=>obs.disconnect(),180000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();

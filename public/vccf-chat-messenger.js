(()=>{
'use strict';
if(window.__VCCF_CHAT_MESSENGER_SAFE__)return;
window.__VCCF_CHAT_MESSENGER_SAFE__=true;
const css=`
.chat-shell{grid-template-columns:minmax(280px,340px) minmax(0,1fr);height:calc(100vh - 155px);max-height:none;min-height:560px}
.chat-inbox{min-height:0}
.chat-inbox-head{padding:16px 14px 12px}
.chat-inbox-head h3{font-size:1.05rem;letter-spacing:-.01em}
.chat-search{height:42px;border-radius:21px;padding:9px 15px}
.chat-list{min-height:0;overscroll-behavior:contain}
.chat-row{position:relative;gap:12px;padding:11px 14px;border-bottom:0;border-radius:12px;margin:2px 7px;width:calc(100% - 14px)}
.chat-row:hover{background:rgba(215,25,32,.055)}
.chat-row.active{background:rgba(215,25,32,.085)}
.chat-row.active::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--brand-gradient)}
.chat-thread{min-height:0;min-width:0;width:100%}
.chat-thread-head{min-height:70px;padding:12px 18px;flex:0 0 auto}
.chat-messages{min-height:0;min-width:0;width:100%;padding:18px 20px 14px;gap:5px;overscroll-behavior:contain}
.chat-bubble-row{display:flex;width:100%;flex:0 0 auto}
.chat-bubble-row > div{width:max-content;max-width:min(72%,620px);min-width:0}
.chat-bubble-row.mine > div{margin-left:auto}
.chat-bubble-row:not(.mine) > div{margin-right:auto}
.chat-bubble{display:block;width:fit-content;max-width:100%;padding:10px 13px;border-radius:17px;box-shadow:0 1px 1px rgba(0,0,0,.035)}
.chat-bubble.mine{background:var(--brand-gradient);color:#fff;border-bottom-right-radius:6px}
.chat-bubble.theirs{background:var(--panel);border:1px solid var(--line);border-bottom-left-radius:6px}
.chat-composer{flex:0 0 auto;align-items:flex-end;padding:10px 12px;gap:8px}
.chat-composer textarea{min-height:42px;max-height:130px;border-radius:21px;padding:10px 15px}
.chat-composer button{width:42px;height:42px;padding:0;border-radius:50%;font-size:0;display:grid;place-items:center}
.chat-composer button::after{content:"➤";font-size:1rem;line-height:1}
@media(max-width:820px){
 .chat-shell{height:calc(100vh - 130px);min-height:520px}
 .chat-messages{padding:14px 13px 12px}
 .chat-thread-head{padding:10px 12px}
 .chat-composer{padding:9px 10px}
 .chat-bubble-row > div{max-width:85%}
}
@media(max-width:600px){.chat-shell{border-radius:16px}.chat-inbox-head{padding:14px}.chat-row{margin:2px 4px;width:calc(100% - 8px)}.chat-messages{padding:12px}.chat-composer{padding:8px}}
`;
function addCss(){if(document.getElementById('vccf-chat-messenger-safe-style'))return;const s=document.createElement('style');s.id='vccf-chat-messenger-safe-style';s.textContent=css;document.head.appendChild(s)}
function bindComposer(){const input=document.getElementById('vccfChatInput');if(!input||input.dataset.messengerSafeBound)return;input.dataset.messengerSafeBound='1';input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,130)+'px'});input.addEventListener('focus',()=>setTimeout(()=>{const box=document.getElementById('vccfChatMessages');if(box)box.scrollTop=box.scrollHeight},60))}
function start(){addCss();bindComposer()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

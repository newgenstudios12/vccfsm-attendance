(()=>{'use strict';if(window.__VCCF_NAV_CLEANUP_V2__)return;window.__VCCF_NAV_CLEANUP_V2__=true;
function loadMessenger(){
 if(window.__VCCF_CHAT_MESSENGER__)return;
 if(document.querySelector('script[data-vccf-chat-messenger]'))return;
 const s=document.createElement('script');s.src='/vccf-chat-messenger.js';s.async=true;s.dataset.vccfChatMessenger='1';document.head.appendChild(s);
}
function clean(){const nav=document.querySelector('.nav');loadMessenger();if(!nav)return;
 const profileBtns=[...nav.querySelectorAll('button')].filter(b=>{const t=(b.textContent||'').replace(/[\u200b\uFEFF]/g,'').trim().toLowerCase();return t==='my profile'||t.includes('my profile')});
 profileBtns.slice(1).forEach(b=>b.remove());
 if(profileBtns[0]){profileBtns[0].textContent='My Profile';profileBtns[0].onclick=e=>{e.preventDefault();window.VCCFMyProfileV2?.open?.()};}
 let sermon=nav.querySelector('button[data-view="sermons"]');
 if(!sermon){sermon=document.createElement('button');sermon.type='button';sermon.dataset.view='sermons';sermon.textContent='📖 Sermons';nav.appendChild(sermon)}
 sermon.onclick=e=>{e.preventDefault();window.VCCFSermons?.open?.()};
}
function boot(){clean();setTimeout(clean,300);setTimeout(clean,1000);setTimeout(clean,2500);new MutationObserver(()=>clean()).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
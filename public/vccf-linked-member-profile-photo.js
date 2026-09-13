(()=>{
'use strict';
if(window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__)return;
window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__=true;

const state=()=>window.VCCF?.getState?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
let activeMemberId=null;

function linked(){
  const s=state(),p=s.profile||null;
  const member=p?.member_id?(s.members||[]).find(m=>m.id===p.member_id)||null:null;
  return{s,p,member};
}
function photoFor(m){
  if(!m)return'';
  const {p}=linked();
  if(String(m.id)===String(p?.member_id))return String(m.photo_url||p?.profile_photo_url||'').trim();
  return String(m.photo_url||'').trim();
}
function putPhoto(el,name,url){
  if(!el||!url)return;
  if(el.dataset.vccfPhotoUrl===url&&el.querySelector('img'))return;
  el.dataset.vccfPhotoUrl=url;
  el.innerHTML=`<img src="${esc(url)}" alt="${esc(name)}" style="width:100%;height:100%;display:block;object-fit:cover;object-position:center;border-radius:inherit">`;
}
function decorate(){
  const {s,p,member}=linked();
  if(member){
    const url=photoFor(member),name=memberName(member)||p?.display_name||s.session?.user?.email||'Profile';
    if(url){
      putPhoto(document.getElementById('avatar'),name,url);
      putPhoto(document.getElementById('sideAvatar'),name,url);
      putPhoto(document.getElementById('profilePhotoPreview'),name,url);
      putPhoto(document.querySelector('#settings .large-avatar'),name,url);
      putPhoto(document.querySelector('#selfcheck .member-initial'),name,url);
    }
  }
  document.querySelectorAll('[data-member-id]').forEach(row=>{
    const m=(s.members||[]).find(x=>String(x.id)===String(row.dataset.memberId));
    const url=photoFor(m);
    if(m&&url)putPhoto(row.querySelector('.member-initial'),memberName(m),url);
  });
  const card=document.querySelector('.member-profile-card');
  if(card){
    let m=activeMemberId?(s.members||[]).find(x=>String(x.id)===String(activeMemberId)):null;
    if(!m){const title=(card.querySelector('h2')?.textContent||'').trim();m=(s.members||[]).find(x=>memberName(x)===title)||null;}
    const url=photoFor(m);
    if(m&&url)putPhoto(card.querySelector('.member-initial'),memberName(m),url);
  }
}
function syncFromCurrentState(){
  const {p,member}=linked();
  if(member&&p){
    const url=String(member.photo_url||p.profile_photo_url||'').trim();
    if(url){member.photo_url=url;p.profile_photo_url=url;}
  }
  decorate();
}
function onPhotoUpdated(event){
  const url=String(event?.detail?.url||'').trim();
  if(!url)return;
  const {p,member}=linked();
  if(p)p.profile_photo_url=url;
  if(member)member.photo_url=url;
  decorate();
  setTimeout(decorate,80);
}
function schedule(){setTimeout(syncFromCurrentState,20);setTimeout(syncFromCurrentState,250)}

window.addEventListener('vccf-app-ready',schedule);
window.addEventListener('vccf-profile-linked',schedule);
window.addEventListener('vccf-profile-photo-updated',onPhotoUpdated);
document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-view-member],[data-member-id]');
  if(el){activeMemberId=el.dataset.viewMember||el.dataset.memberId||activeMemberId;setTimeout(decorate,0);setTimeout(decorate,100)}
},true);
const observer=new MutationObserver(()=>setTimeout(decorate,0));
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
setTimeout(schedule,0);
})();

(()=>{
'use strict';
if(window.__VCCF_MEMBER_CONTACT_MODULE_LOADER__)return;
window.__VCCF_MEMBER_CONTACT_MODULE_LOADER__=true;

function loadMemberContactModule(){
  if(window.__VCCF_MEMBER_CONTACT_INFO__)return true;
  if(document.querySelector('script[data-vccf-member-contact-info]'))return true;
  const script=document.createElement('script');
  script.src='/vccf-member-contact-info.js?v=20260913-2';
  script.dataset.vccfMemberContactInfo='1';
  script.async=false;
  script.onerror=()=>console.error('Member contact information module could not be loaded.');
  document.head.appendChild(script);
  return true;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadMemberContactModule,{once:true});
else loadMemberContactModule();
window.addEventListener('vccf-app-ready',loadMemberContactModule);
})();

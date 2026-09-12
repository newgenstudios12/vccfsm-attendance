(()=>{
'use strict';
if(window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__)return;
window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__=true;

const state=()=>window.VCCF?.getState?.()||{};
const client=()=>window.VCCF?.sb||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=v=>String(v||'VCCF').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'V';
let syncing=false;

function linkedContext(){
  const s=state(),p=s.profile||null;
  if(!p?.member_id)return{s,p,member:null};
  const member=(s.members||[]).find(m=>m.id===p.member_id)||null;
  return{s,p,member};
}

function paint(el,name,url){
  if(!el)return;
  el.innerHTML=url?`<img src="${esc(url)}" alt="${esc(name)}">`:esc(initials(name));
}

function paintLinkedPhoto(url){
  const {s,p,member}=linkedContext();
  if(!p||!member)return;
  const name=member.display_name||p.display_name||s.session?.user?.email||'Profile picture';
  paint(document.getElementById('avatar'),name,url);
  paint(document.getElementById('sideAvatar'),name,url);
  paint(document.getElementById('profilePhotoPreview'),name,url);
  paint(document.querySelector('#settings .large-avatar'),name,url);
}

async function syncLinkedPhoto(){
  if(syncing)return;
  const sb=client(),{s,p,member}=linkedContext();
  if(!sb||!p||!member)return;
  syncing=true;
  try{
    const memberUrl=String(member.photo_url||'').trim();
    const profileUrl=String(p.profile_photo_url||'').trim();

    // Linked member is the source of truth. Preserve a legacy account photo
    // by migrating it into an empty member record once.
    if(!memberUrl&&profileUrl){
      const r=await sb.from('members').update({photo_url:profileUrl}).eq('id',member.id);
      if(r.error)throw r.error;
      member.photo_url=profileUrl;
      paintLinkedPhoto(profileUrl);
      return;
    }

    if(memberUrl){
      p.profile_photo_url=memberUrl;
      paintLinkedPhoto(memberUrl);
      if(profileUrl!==memberUrl&&s.session?.user?.id){
        const r=await sb.from('profiles').update({profile_photo_url:memberUrl}).eq('user_id',s.session.user.id);
        if(r.error)console.warn('VCCF linked profile photo mirror failed:',r.error);
      }
    }
  }catch(error){
    console.warn('VCCF linked member profile photo sync failed:',error);
  }finally{
    syncing=false;
  }
}

async function persistUploadedPhoto(event){
  const url=String(event?.detail?.url||'').trim();
  if(!url)return;
  const sb=client(),{s,p,member}=linkedContext();
  if(!sb||!p||!member)return;
  try{
    const r=await sb.from('members').update({photo_url:url}).eq('id',member.id);
    if(r.error)throw r.error;
    member.photo_url=url;
    p.profile_photo_url=url;
    paintLinkedPhoto(url);
    if(s.session?.user?.id){
      const mirror=await sb.from('profiles').update({profile_photo_url:url}).eq('user_id',s.session.user.id);
      if(mirror.error)console.warn('VCCF linked profile photo mirror failed:',mirror.error);
    }
  }catch(error){
    console.error('VCCF linked member profile photo save failed:',error);
    const msg=document.getElementById('profilePhotoMsg');
    if(msg)msg.textContent='Picture uploaded, but the linked member photo could not be updated. Please try again.';
  }
}

function scheduleSync(){setTimeout(()=>syncLinkedPhoto(),40);setTimeout(()=>syncLinkedPhoto(),350);}
window.addEventListener('vccf-app-ready',scheduleSync);
window.addEventListener('vccf-profile-linked',scheduleSync);
window.addEventListener('vccf-profile-photo-updated',persistUploadedPhoto);

const observer=new MutationObserver(mutations=>{
  if(!state().profile?.member_id)return;
  for(const mutation of mutations){
    if([...mutation.addedNodes].some(n=>n.nodeType===1&&(n.id==='settings'||n.querySelector?.('#profilePhotoPreview,.large-avatar')))){
      scheduleSync();
      break;
    }
  }
});
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});

// Also run once in case the app-ready event fired before this script loaded.
setTimeout(scheduleSync,0);
})();

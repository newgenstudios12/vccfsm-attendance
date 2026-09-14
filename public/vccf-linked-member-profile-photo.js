(()=>{
'use strict';
if(window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__)return;
window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__=true;

const state=()=>window.VCCF?.getState?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
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
  script.src='/vccf-member-contact-info.js?v=20260913-4';
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

(()=>{
'use strict';
if(window.__VCCF_MEMBER_DELETE_BUTTON_LOADER__)return;
window.__VCCF_MEMBER_DELETE_BUTTON_LOADER__=true;
function loadMemberDeleteButton(){
  if(window.__VCCF_MEMBER_DELETE_BUTTON__)return true;
  if(document.querySelector('script[data-vccf-member-delete-button]'))return true;
  const script=document.createElement('script');
  script.src='/vccf-member-delete-button.js?v=20260913-2';
  script.dataset.vccfMemberDeleteButton='1';
  script.async=false;
  script.onerror=()=>console.error('Member delete button module could not be loaded.');
  document.head.appendChild(script);
  return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadMemberDeleteButton,{once:true});
else loadMemberDeleteButton();
window.addEventListener('vccf-app-ready',loadMemberDeleteButton);
})();

(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_CHECKLIST_LOADER__)return;
window.__VCCF_ATTENDANCE_CHECKLIST_LOADER__=true;
function loadAttendanceChecklist(){
  if(window.__VCCF_ATTENDANCE_CHECKLIST__)return true;
  if(document.querySelector('script[data-vccf-attendance-checklist]'))return true;
  const script=document.createElement('script');
  script.src='/vccf-attendance-checklist.js?v=20260913-1';
  script.dataset.vccfAttendanceChecklist='1';
  script.async=false;
  script.onerror=()=>console.error('Attendance checklist module could not be loaded.');
  document.head.appendChild(script);
  return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAttendanceChecklist,{once:true});
else loadAttendanceChecklist();
window.addEventListener('vccf-app-ready',loadAttendanceChecklist);
})();

(()=>{
'use strict';
if(window.__VCCF_PROFILE_PHOTO_PICKER_STABLE__)return;
window.__VCCF_PROFILE_PHOTO_PICKER_STABLE__=true;

const adjustedPhotos=new WeakMap();
let originalCropperOpen=null;

function validatePhoto(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Please choose a photo.');
  if(file.size>12*1024*1024)throw new Error('Please choose a photo smaller than 12 MB.');
}
function fallbackPrepare(file){
  return new Promise((resolve,reject)=>{
    try{validatePhoto(file)}catch(error){reject(error);return}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read that photo. Please try another image.'));
    reader.onload=()=>{
      const image=new Image();
      image.onerror=()=>reject(new Error('Could not read that photo. Please choose a JPEG, PNG, or WebP image.'));
      image.onload=()=>{
        try{
          const width=640,height=611,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
          if(!ctx)throw new Error('Your browser could not prepare the photo.');
          canvas.width=width;canvas.height=height;
          const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
          const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;
          ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
          ctx.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
          resolve(canvas.toDataURL('image/jpeg',.84));
        }catch(error){reject(error)}
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function installStablePreparation(){
  const cropper=window.VCCFPhotoCropper;
  if(!cropper?.open)return;
  if(cropper.open.__vccfStablePrepare){
    if(!originalCropperOpen&&cropper.open.__vccfOriginal)originalCropperOpen=cropper.open.__vccfOriginal;
    return;
  }
  originalCropperOpen=cropper.open.bind(cropper);
  const stable=async file=>adjustedPhotos.get(file)||await fallbackPrepare(file);
  stable.__vccfStablePrepare=true;
  stable.__vccfOriginal=originalCropperOpen;
  cropper.open=stable;
}
function addNativeChooseControl(input){
  if(!input||input.dataset.vccfNativePhotoPicker==='1')return;
  input.dataset.vccfNativePhotoPicker='1';
  input.accept='image/*';
  input.disabled=false;
  input.style.display='block';
  input.style.maxWidth='100%';
  input.style.marginBottom='8px';
  const label=document.createElement('label');
  label.htmlFor=input.id;
  label.className='btn secondary vccf-choose-profile-photo';
  label.textContent='Choose photo';
  label.style.display='inline-flex';
  label.style.alignItems='center';
  label.style.justifyContent='center';
  label.style.margin='0 0 8px';
  label.style.cursor='pointer';
  input.parentElement?.insertBefore(label,input);
}
function previewSelectedFile(input,preview,msg){
  const file=input?.files?.[0];
  if(!file)return;
  try{validatePhoto(file)}catch(error){input.value='';if(msg)msg.textContent=error.message;return}
  const reader=new FileReader();
  reader.onerror=()=>{if(msg)msg.textContent='Could not preview that photo. Please try another image.'};
  reader.onload=()=>{
    if(preview)preview.innerHTML='<img src="'+String(reader.result)+'" alt="Selected profile picture preview">';
    if(msg)msg.textContent='Photo selected. You can save it now or adjust it first.';
  };
  reader.readAsDataURL(file);
}
function hardenSettingsPicker(){
  installStablePreparation();
  const input=document.getElementById('profilePhotoInput');
  if(!input||input.dataset.vccfStableSettingsPicker==='1')return;
  input.dataset.vccfStableSettingsPicker='1';
  addNativeChooseControl(input);
  const preview=document.getElementById('profilePhotoPreview');
  const msg=document.getElementById('profilePhotoMsg');
  const save=document.getElementById('saveProfilePhoto');
  const adjust=document.getElementById('adjustCurrentProfilePhoto');
  input.onchange=()=>{
    const file=input.files?.[0];
    if(!file)return;
    previewSelectedFile(input,preview,msg);
    if(save)save.disabled=false;
    if(adjust){adjust.disabled=false;adjust.textContent='Adjust selected photo'}
  };
  if(adjust){
    adjust.textContent='Adjust selected photo';
    adjust.disabled=!input.files?.[0];
    adjust.onclick=async()=>{
      const file=input.files?.[0];
      if(!file){if(msg)msg.textContent='Choose a photo first.';return}
      if(!originalCropperOpen){if(msg)msg.textContent='Photo adjustment is unavailable, but you can still save the selected photo.';return}
      adjust.disabled=true;if(save)save.disabled=true;if(msg)msg.textContent='Adjust your photo…';
      try{
        const image=await originalCropperOpen(file);
        if(!image){if(msg)msg.textContent='Photo adjustment cancelled.';return}
        adjustedPhotos.set(file,image);
        if(preview)preview.innerHTML='<img src="'+image+'" alt="Adjusted profile picture preview">';
        if(msg)msg.textContent='Photo adjusted. Select Save picture to apply it.';
      }catch(error){
        console.warn('VCCF photo adjustment failed:',error);
        if(msg)msg.textContent='Could not open the adjustment tool. You can still save the selected photo.';
      }finally{
        adjust.disabled=false;if(save)save.disabled=false;
      }
    };
  }
}
function hardenV2Picker(){
  const input=document.getElementById('v2File');
  if(!input)return;
  addNativeChooseControl(input);
}
function hardenPickers(){
  installStablePreparation();
  hardenSettingsPicker();
  hardenV2Picker();
}

const pickerObserver=new MutationObserver(()=>setTimeout(hardenPickers,0));
if(document.body){pickerObserver.observe(document.body,{childList:true,subtree:true});hardenPickers()}
else document.addEventListener('DOMContentLoaded',()=>{pickerObserver.observe(document.body,{childList:true,subtree:true});hardenPickers()},{once:true});
window.addEventListener('vccf-app-ready',hardenPickers);
window.addEventListener('vccf-profile-linked',hardenPickers);
setTimeout(hardenPickers,0);
})();

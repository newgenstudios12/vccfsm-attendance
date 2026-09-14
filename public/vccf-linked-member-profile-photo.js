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

(()=>{
'use strict';
if(window.__VCCF_PROFILE_PHOTO_PERSISTENT_SELECTION__)return;
window.__VCCF_PROFILE_PHOTO_PERSISTENT_SELECTION__=true;

const pending={file:null,prepared:null,previewUrl:null,ownerId:null};
const getState=()=>window.VCCF?.getState?.()||{};
const escText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function currentUserId(){return getState().session?.user?.id||null}
function message(text){const el=document.getElementById('profilePhotoMsg');if(el)el.textContent=text||''}
function validate(file){
  if(!file)throw new Error('Please choose a photo.');
  const type=String(file.type||'').toLowerCase(),name=String(file.name||'').toLowerCase();
  if(!(type.startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/.test(name)))throw new Error('Please choose an image from your photo library.');
  if(file.size>35*1024*1024)throw new Error('That photo is too large. Please choose a photo smaller than 35 MB.');
}
function releasePreview(){if(pending.previewUrl){try{URL.revokeObjectURL(pending.previewUrl)}catch(_){ }pending.previewUrl=null}}
function resetPending(){releasePreview();pending.file=null;pending.prepared=null;pending.ownerId=null}
function setPreview(src,kind='selected'){
  const preview=document.getElementById('profilePhotoPreview');
  if(!preview||!src)return;
  preview.dataset.vccfPendingPhoto=kind;
  preview.innerHTML='<img src="'+escText(src)+'" alt="Selected profile picture preview">';
}
function selectedName(){return pending.file?.name||'Photo from library'}
function ensureSelectedStatus(input){
  const parent=input?.parentElement;if(!parent)return null;
  let status=parent.querySelector('#vccfSelectedPhotoName');
  if(!status){status=document.createElement('div');status.id='vccfSelectedPhotoName';status.className='settings-message';status.style.margin='2px 0 10px';status.style.fontWeight='700';parent.insertBefore(status,input.nextSibling)}
  return status;
}
function hideNativeInput(input){
  input.accept='image/*';input.disabled=false;
  input.style.position='absolute';input.style.width='1px';input.style.height='1px';input.style.padding='0';input.style.margin='-1px';input.style.overflow='hidden';input.style.clip='rect(0 0 0 0)';input.style.clipPath='inset(50%)';input.style.whiteSpace='nowrap';input.style.border='0';input.style.opacity='0';
}
function ensureChooseLabel(input){
  const parent=input?.parentElement;if(!parent)return null;
  let label=parent.querySelector('.vccf-choose-profile-photo');
  if(!label){label=document.createElement('label');label.htmlFor=input.id;label.className='btn secondary vccf-choose-profile-photo';parent.insertBefore(label,input)}
  label.htmlFor=input.id;label.textContent=pending.file?'Choose another photo':'Choose photo';label.style.display='inline-flex';label.style.alignItems='center';label.style.justifyContent='center';label.style.cursor='pointer';label.style.margin='0 0 8px';return label;
}
function bindSettings(){
  const input=document.getElementById('profilePhotoInput');if(!input)return;
  hideNativeInput(input);ensureChooseLabel(input);
  const status=ensureSelectedStatus(input),save=document.getElementById('saveProfilePhoto'),adjust=document.getElementById('adjustCurrentProfilePhoto');
  if(status)status.textContent=pending.file?'Selected: '+selectedName():'No new photo selected';
  if(adjust){adjust.textContent='Adjust selected photo';adjust.disabled=!pending.file}
  if(save)save.disabled=false;
  if(pending.prepared)setPreview(pending.prepared,'adjusted');
  else if(pending.previewUrl)setPreview(pending.previewUrl,'selected');
}
function preparePhoto(file){
  return new Promise((resolve,reject)=>{
    try{validate(file)}catch(error){reject(error);return}
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{
      try{
        const width=640,height=611,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
        if(!ctx)throw new Error('Your browser could not prepare the photo.');
        canvas.width=width;canvas.height=height;
        const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
        if(!iw||!ih)throw new Error('The selected photo could not be read.');
        const scale=Math.max(width/iw,height/ih),dw=iw*scale,dh=ih*scale;
        ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,(width-dw)/2,(height-dh)/2,dw,dh);
        resolve(canvas.toDataURL('image/jpeg',.84));
      }catch(error){reject(error)}finally{URL.revokeObjectURL(url)}
    };
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that photo. Try another image from Photos.'))};
    image.src=url;
  });
}
async function chooseChange(event){
  const input=event.target;if(!(input instanceof HTMLInputElement)||!['profilePhotoInput','v2File'].includes(input.id)||input.type!=='file')return;
  const file=input.files?.[0];if(!file)return;
  event.stopImmediatePropagation();
  try{
    validate(file);releasePreview();pending.file=file;pending.prepared=null;pending.ownerId=currentUserId();pending.previewUrl=URL.createObjectURL(file);setPreview(pending.previewUrl);message('Photo selected. Tap Save picture, or adjust it first.');bindSettings();
  }catch(error){resetPending();message(error?.message||'Could not select that photo.');bindSettings()}
  setTimeout(()=>{try{input.value=''}catch(_){ }},0);
}
function cropperOpen(){
  const open=window.VCCFPhotoCropper?.open;if(!open)return null;
  return open.__vccfOriginal||open;
}
async function adjustSelected(event){
  const button=event.target.closest?.('#adjustCurrentProfilePhoto');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!pending.file){message('Choose a photo first.');return}
  if(pending.ownerId&&pending.ownerId!==currentUserId()){resetPending();bindSettings();message('Your account changed. Please choose the photo again.');return}
  const save=document.getElementById('saveProfilePhoto');button.disabled=true;if(save)save.disabled=true;message('Adjust your photo…');
  try{
    const open=cropperOpen();
    if(!open){message('Adjustment is unavailable, but the selected photo is ready to save.');return}
    const adjusted=await open.call(window.VCCFPhotoCropper,pending.file);
    if(!adjusted){message('Adjustment cancelled. Your selected photo is still ready to save.');return}
    pending.prepared=adjusted;setPreview(adjusted,'adjusted');message('Photo adjusted. Tap Save picture to apply it.');
  }catch(error){console.warn('VCCF photo adjustment failed:',error);message('Adjustment could not open, but the selected photo is still ready to save.')}finally{button.disabled=false;if(save)save.disabled=false;bindSettings()}
}
async function saveSelected(event){
  const button=event.target.closest?.('#saveProfilePhoto');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!pending.file&&!pending.prepared){message('Choose a photo first.');return}
  const owner=currentUserId();if(!owner||pending.ownerId&&pending.ownerId!==owner){resetPending();bindSettings();message('Your account changed. Please choose the photo again.');return}
  const adjust=document.getElementById('adjustCurrentProfilePhoto');button.disabled=true;if(adjust)adjust.disabled=true;message('Saving picture…');
  try{
    const image=pending.prepared||await preparePhoto(pending.file);
    const session=(await window.VCCF?.sb?.auth?.getSession?.())?.data?.session;
    if(!session?.access_token||session.user?.id!==owner)throw new Error('Your session has expired. Please sign in again.');
    const response=await fetch(window.VCCF_SUPABASE_URL+'/functions/v1/save-profile-photo',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.VCCF_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({image,mime:'image/jpeg'})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result?.ok||!result?.url)throw new Error(result?.error||'Unable to save your profile picture.');
    const s=getState(),p=s.profile||null;if(p)p.profile_photo_url=result.url;const member=p?.member_id?(s.members||[]).find(m=>String(m.id)===String(p.member_id)):null;if(member)member.photo_url=result.url;
    resetPending();window.dispatchEvent(new CustomEvent('vccf-profile-photo-updated',{detail:{url:result.url}}));message('Profile picture saved.');bindSettings();
    const status=document.getElementById('vccfSelectedPhotoName');if(status)status.textContent='Photo saved successfully';
  }catch(error){message(error?.message||'Unable to save your profile picture.')}finally{button.disabled=false;if(adjust)adjust.disabled=!pending.file}
}

document.addEventListener('change',chooseChange,true);
document.addEventListener('click',event=>{if(event.target.closest?.('#adjustCurrentProfilePhoto'))void adjustSelected(event);else if(event.target.closest?.('#saveProfilePhoto'))void saveSelected(event)},true);
const observer=new MutationObserver(()=>queueMicrotask(bindSettings));
if(document.body){observer.observe(document.body,{childList:true,subtree:true});bindSettings()}else document.addEventListener('DOMContentLoaded',()=>{observer.observe(document.body,{childList:true,subtree:true});bindSettings()},{once:true});
window.addEventListener('vccf-app-ready',()=>setTimeout(bindSettings,0));window.addEventListener('vccf-profile-linked',()=>setTimeout(bindSettings,0));
})();

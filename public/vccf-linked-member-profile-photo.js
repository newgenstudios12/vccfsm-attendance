(()=>{
'use strict';
if(window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__)return;
window.__VCCF_LINKED_MEMBER_PROFILE_PHOTO__=true;

const state=()=>window.VCCF?.getState?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
let activeMemberId=null,decorateQueued=false;

function linked(){
  const s=state(),p=s.profile||null;
  const member=p?.member_id?(s.members||[]).find(m=>String(m.id)===String(p.member_id))||null:null;
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
  if(el.id==='profilePhotoPreview'&&el.dataset.vccfPendingPhoto)return;
  if(el.dataset.vccfPhotoUrl===url&&el.querySelector('img'))return;
  el.dataset.vccfPhotoUrl=url;
  el.innerHTML=`<img src="${esc(url)}" alt="${esc(name)}" style="width:100%;height:100%;display:block;object-fit:cover;object-position:center;border-radius:inherit">`;
}
function decorate(){
  decorateQueued=false;
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
    const url=photoFor(m);if(m&&url)putPhoto(row.querySelector('.member-initial'),memberName(m),url);
  });
  const card=document.querySelector('.member-profile-card');
  if(card){
    let m=activeMemberId?(s.members||[]).find(x=>String(x.id)===String(activeMemberId)):null;
    if(!m){const title=(card.querySelector('h2')?.textContent||'').trim();m=(s.members||[]).find(x=>memberName(x)===title)||null;}
    const url=photoFor(m);if(m&&url)putPhoto(card.querySelector('.member-initial'),memberName(m),url);
  }
}
function queueDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(decorate)}
function syncFromCurrentState(){
  const {p,member}=linked();
  if(member&&p){const url=String(member.photo_url||p.profile_photo_url||'').trim();if(url){member.photo_url=url;p.profile_photo_url=url;}}
  queueDecorate();
}
function onPhotoUpdated(event){
  const url=String(event?.detail?.url||'').trim();if(!url)return;
  const {p,member}=linked();if(p)p.profile_photo_url=url;if(member)member.photo_url=url;queueDecorate();
}
window.addEventListener('vccf-app-ready',syncFromCurrentState);
window.addEventListener('vccf-profile-linked',syncFromCurrentState);
window.addEventListener('vccf-profile-photo-updated',onPhotoUpdated);
document.addEventListener('click',event=>{const el=event.target.closest?.('[data-view-member],[data-member-id]');if(el){activeMemberId=el.dataset.viewMember||el.dataset.memberId||activeMemberId;queueDecorate()}},true);
const observer=new MutationObserver(queueDecorate);
if(document.body){observer.observe(document.body,{childList:true,subtree:true});queueDecorate()}
else document.addEventListener('DOMContentLoaded',()=>{observer.observe(document.body,{childList:true,subtree:true});queueDecorate()},{once:true});
})();

(()=>{
'use strict';
function loadOnce(globalGuard,scriptGuard,src,errorText){
  if(window[globalGuard])return;
  if(document.querySelector(`script[${scriptGuard}]`))return;
  const script=document.createElement('script');script.src=src;script.async=false;script.setAttribute(scriptGuard,'1');script.onerror=()=>console.error(errorText);document.head.appendChild(script);
}
function loadExtras(){
  loadOnce('__VCCF_MEMBER_CONTACT_INFO__','data-vccf-member-contact-info','/vccf-member-contact-info.js?v=20260913-4','Member contact information module could not be loaded.');
  loadOnce('__VCCF_MEMBER_DELETE_BUTTON__','data-vccf-member-delete-button','/vccf-member-delete-button.js?v=20260913-2','Member delete button module could not be loaded.');
  loadOnce('__VCCF_ATTENDANCE_CHECKLIST__','data-vccf-attendance-checklist','/vccf-attendance-checklist.js?v=20260913-1','Attendance checklist module could not be loaded.');
  loadOnce('__VCCF_ID_POSITION_EDITOR__','data-vccf-id-position-editor','/vccf-id-position-editor.js?v=20260914-1','Digital ID position editor module could not be loaded.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadExtras,{once:true});else loadExtras();
window.addEventListener('vccf-app-ready',loadExtras);
})();

(()=>{
'use strict';
if(window.__VCCF_PROFILE_PHOTO_FLOW_V3__)return;
window.__VCCF_PROFILE_PHOTO_FLOW_V3__=true;

const pending={file:null,prepared:null,previewUrl:null,ownerId:null};
const getState=()=>window.VCCF?.getState?.()||{};
let bindQueued=false;

function currentUserId(){return getState().session?.user?.id||null}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function message(text){setText(document.getElementById('profilePhotoMsg'),text||'')}
function validate(file){
  if(!file)throw new Error('Please choose a photo.');
  const type=String(file.type||'').toLowerCase(),name=String(file.name||'').toLowerCase();
  if(!(type.startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/.test(name)))throw new Error('Please choose an image from your photo library.');
  if(file.size>35*1024*1024)throw new Error('That photo is too large. Please choose a photo smaller than 35 MB.');
}
function releasePreview(){if(pending.previewUrl){try{URL.revokeObjectURL(pending.previewUrl)}catch(_){}pending.previewUrl=null}}
function resetPending(){releasePreview();pending.file=null;pending.prepared=null;pending.ownerId=null}
function selectedName(){return pending.file?.name||'Photo from library'}
function setPreview(src,kind='selected'){
  const preview=document.getElementById('profilePhotoPreview');if(!preview||!src)return;
  if(preview.dataset.vccfPendingSrc===src&&preview.dataset.vccfPendingPhoto===kind&&preview.querySelector('img'))return;
  preview.dataset.vccfPendingPhoto=kind;preview.dataset.vccfPendingSrc=src;preview.removeAttribute('data-vccf-photo-url');
  const img=document.createElement('img');img.src=src;img.alt='Selected profile picture preview';preview.replaceChildren(img);
}
function clearPreviewMarker(){const preview=document.getElementById('profilePhotoPreview');if(preview){delete preview.dataset.vccfPendingPhoto;delete preview.dataset.vccfPendingSrc}}
function ensureStatus(input){
  const parent=input?.parentElement;if(!parent)return null;
  let status=parent.querySelector('#vccfSelectedPhotoName');
  if(!status){status=document.createElement('div');status.id='vccfSelectedPhotoName';status.className='settings-message';status.style.margin='2px 0 10px';status.style.fontWeight='700';parent.insertBefore(status,input.nextSibling)}
  return status;
}
function hideNativeInput(input){
  if(input.dataset.vccfHiddenPhotoInput==='1')return;
  input.dataset.vccfHiddenPhotoInput='1';input.accept='image/*';input.disabled=false;
  Object.assign(input.style,{position:'absolute',width:'1px',height:'1px',padding:'0',margin:'-1px',overflow:'hidden',clip:'rect(0 0 0 0)',clipPath:'inset(50%)',whiteSpace:'nowrap',border:'0',opacity:'0'});
}
function ensureChooseLabel(input){
  const parent=input?.parentElement;if(!parent)return null;
  let label=parent.querySelector('.vccf-choose-profile-photo');
  if(!label){label=document.createElement('label');label.className='btn secondary vccf-choose-profile-photo';label.style.display='inline-flex';label.style.alignItems='center';label.style.justifyContent='center';label.style.cursor='pointer';label.style.margin='0 0 8px';parent.insertBefore(label,input)}
  label.htmlFor=input.id;setText(label,pending.file?'Choose another photo':'Choose photo');return label;
}
function bindSettings(){
  bindQueued=false;
  const input=document.getElementById('profilePhotoInput');if(!input)return;
  hideNativeInput(input);ensureChooseLabel(input);
  const status=ensureStatus(input),save=document.getElementById('saveProfilePhoto'),adjust=document.getElementById('adjustCurrentProfilePhoto');
  setText(status,pending.file?'Selected: '+selectedName():'No new photo selected');
  if(adjust){setText(adjust,'Adjust selected photo');adjust.disabled=!pending.file}
  if(save)save.disabled=!(pending.file||pending.prepared);
  if(pending.prepared)setPreview(pending.prepared,'adjusted');else if(pending.previewUrl)setPreview(pending.previewUrl,'selected');
}
function queueBind(){if(bindQueued)return;bindQueued=true;requestAnimationFrame(bindSettings)}
function preparePhoto(file){
  return new Promise((resolve,reject)=>{
    try{validate(file)}catch(error){reject(error);return}
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{try{const width=640,height=611,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not prepare the photo.');canvas.width=width;canvas.height=height;const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)throw new Error('The selected photo could not be read.');const scale=Math.max(width/iw,height/ih),dw=iw*scale,dh=ih*scale;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,(width-dw)/2,(height-dh)/2,dw,dh);resolve(canvas.toDataURL('image/jpeg',.84))}catch(error){reject(error)}finally{URL.revokeObjectURL(url)}};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that photo. Try another image from Photos.'))};image.src=url;
  });
}
function chooseChange(event){
  const input=event.target;if(!(input instanceof HTMLInputElement)||input.id!=='profilePhotoInput'||input.type!=='file')return;
  const file=input.files?.[0];if(!file)return;
  event.preventDefault();event.stopImmediatePropagation();
  try{validate(file);releasePreview();pending.file=file;pending.prepared=null;pending.ownerId=currentUserId();pending.previewUrl=URL.createObjectURL(file);setPreview(pending.previewUrl);message('Photo selected. Tap Save picture, or adjust it first.');queueBind()}catch(error){resetPending();message(error?.message||'Could not select that photo.');queueBind()}
  setTimeout(()=>{try{input.value=''}catch(_){}},0);
}
async function adjustSelected(event){
  const button=event.target.closest?.('#adjustCurrentProfilePhoto');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!pending.file){message('Choose a photo first.');return}
  if(pending.ownerId&&pending.ownerId!==currentUserId()){resetPending();clearPreviewMarker();message('Your account changed. Please choose the photo again.');queueBind();return}
  const save=document.getElementById('saveProfilePhoto');button.disabled=true;if(save)save.disabled=true;message('Adjust your photo…');
  try{const open=window.VCCFPhotoCropper?.open;if(!open){message('Adjustment is unavailable, but the selected photo is ready to save.');return}const adjusted=await open.call(window.VCCFPhotoCropper,pending.file);if(!adjusted){message('Adjustment cancelled. Your selected photo is still ready to save.');return}pending.prepared=adjusted;setPreview(adjusted,'adjusted');message('Photo adjusted. Tap Save picture to apply it.')}catch(error){console.warn('VCCF photo adjustment failed:',error);message('Adjustment could not open, but the selected photo is still ready to save.')}finally{queueBind()}
}
async function saveSelected(event){
  const button=event.target.closest?.('#saveProfilePhoto');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!pending.file&&!pending.prepared){message('Choose a photo first.');return}
  const owner=currentUserId();if(!owner||(pending.ownerId&&pending.ownerId!==owner)){resetPending();clearPreviewMarker();message('Your account changed. Please choose the photo again.');queueBind();return}
  const adjust=document.getElementById('adjustCurrentProfilePhoto');button.disabled=true;if(adjust)adjust.disabled=true;message('Saving picture…');
  try{
    const image=pending.prepared||await preparePhoto(pending.file);
    const session=(await window.VCCF?.sb?.auth?.getSession?.())?.data?.session;if(!session?.access_token||session.user?.id!==owner)throw new Error('Your session has expired. Please sign in again.');
    const response=await fetch(window.VCCF_SUPABASE_URL+'/functions/v1/save-profile-photo',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.VCCF_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({image,mime:'image/jpeg'})});
    const result=await response.json().catch(()=>({}));if(!response.ok||!result?.ok||!result?.url)throw new Error(result?.error||'Unable to save your profile picture.');
    const s=getState(),p=s.profile||null;if(p)p.profile_photo_url=result.url;const member=p?.member_id?(s.members||[]).find(m=>String(m.id)===String(p.member_id)):null;if(member)member.photo_url=result.url;
    resetPending();clearPreviewMarker();window.dispatchEvent(new CustomEvent('vccf-profile-photo-updated',{detail:{url:result.url}}));message('Profile picture saved.');queueBind();
  }catch(error){message(error?.message||'Unable to save your profile picture.');queueBind()}
}

document.addEventListener('change',chooseChange,true);
document.addEventListener('click',event=>{if(event.target.closest?.('#adjustCurrentProfilePhoto'))void adjustSelected(event);else if(event.target.closest?.('#saveProfilePhoto'))void saveSelected(event)},true);
const settingsObserver=new MutationObserver(records=>{
  for(const record of records){for(const node of record.addedNodes){if(node.nodeType!==1)continue;if(node.id==='profilePhotoInput'||node.querySelector?.('#profilePhotoInput')){queueBind();return}}}
});
function startObserver(){settingsObserver.observe(document.body,{childList:true,subtree:true});queueBind()}
if(document.body)startObserver();else document.addEventListener('DOMContentLoaded',startObserver,{once:true});
window.addEventListener('vccf-app-ready',queueBind);window.addEventListener('vccf-profile-linked',queueBind);window.addEventListener('vccf-signed-out',()=>{resetPending();clearPreviewMarker()});
})();

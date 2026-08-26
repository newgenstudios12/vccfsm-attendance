(()=>{
'use strict';
if(window.__VCCF_MEMBER_ACCESS_V3__)return;
window.__VCCF_MEMBER_ACCESS_V3__=true;
const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const accessLabels=['Member','Guest','Area Leader','Pastor','Admin'];
const unassignedLabel='No Designated Area';
const santaMariaLagunaBarangays=['Adia','Bagong Pook','Bagumbayan','Bubukal','Cabooan','Calangay','Cambuja','Coralan','Cueva','Inayapan','Jose Laurel, Sr.','Kayhakat','Macasipac','Masinao','Mataling-Ting','Pao-o','Parang Ng Buho','Barangay I','Barangay II','Barangay III','Barangay IV','Jose Rizal','Santiago','Talangka','Tungkod'];
const toastMsg=m=>{if(typeof toast==='function')toast(m);else{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfAccessToast);window.__vccfAccessToast=setTimeout(()=>x.classList.remove('show'),2500);}}};
const normalizedRole=()=>String(window.session?.role||'').trim().toLowerCase().replace(/[_-]+/g,' ');
const canManageMembers=()=>['admin','area leader'].includes(normalizedRole());
let cachedAreas=[];
async function loadAreas(){
 if(cachedAreas.length)return cachedAreas;
 const local=(typeof db!=='undefined'&&Array.isArray(db.areas))?db.areas:[];
 if(local.length){cachedAreas=local.slice();return cachedAreas;}
 const {data,error}=await client.from('areas').select('id,name').order('name',{ascending:true});
 if(error)throw error;
 cachedAreas=Array.isArray(data)?data:[];
 if(typeof db!=='undefined')db.areas=cachedAreas;
 return cachedAreas;
}
function splitAddress(raw){
 const s=String(raw||'').trim(),suffix=', Santa Maria, Laguna';
 if(s.endsWith(suffix)){const body=s.slice(0,-suffix.length).trim(),parts=body.split(','),barangay=parts.pop()?.trim()||'';return{mode:'local',street:parts.join(',').trim(),barangay,other:''};}
 return{mode:s?'other':'local',street:'',barangay:'',other:s};
}
async function saveMemberFromForm(existing){
 const fullName=document.getElementById('mName').value.trim();
 if(!fullName)throw new Error('Name is required.');
 const parts=fullName.split(/\s+/),first_name=parts.shift()||fullName,last_name=parts.join(' ')||'';
 const birthday=document.getElementById('mBirth').value||null;
 const type=document.getElementById('mAccess').value;
 const areaValue=document.getElementById('mArea').value;
 const areas=await loadAreas();
 const area_id=areaValue===unassignedLabel?null:areas.find(a=>a.name===areaValue)?.id||null;
 const addressMode=document.getElementById('mAddressMode')?.value||'local';
 const street=document.getElementById('mStreet')?.value.trim()||'';
 const barangay=document.getElementById('mBarangay')?.value||'';
 const otherAddress=document.getElementById('mOtherAddress')?.value.trim()||'';
 const file=document.getElementById('mPhoto')?.files?.[0];
 let photo=existing?.photo||existing?.photo_url||'';
 if(file){
  if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');
  if(file.size>5*1024*1024)throw new Error('Profile picture must be 5 MB or smaller.');
  photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=320,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)});
 }
 if(addressMode==='local'&&!barangay)throw new Error('Please select a barangay.');
 if(addressMode==='other'&&!otherAddress)throw new Error('Please enter the other address.');
 if((type==='Member'||type==='Area Leader')&&!area_id)throw new Error(type+' members should have a designated area.');
 const address=addressMode==='other'?otherAddress:[street,barangay,'Santa Maria, Laguna'].filter(Boolean).join(', ');
 const payload={first_name,last_name,birth_date:birthday,address,area_id,photo_url:photo||null,member_type:type,updated_at:new Date().toISOString()};
 const r=existing?await client.from('members').update(payload).eq('id',existing.id):await client.from('members').insert({...payload,display_name:fullName}).select('id').single();
 if(r.error)throw r.error;
}
async function renderAccessForm(existing){
 const type=document.getElementById('mAccess'),area=document.getElementById('mArea'),barangay=document.getElementById('mBarangay'),mode=document.getElementById('mAddressMode');
 if(!type||!area)return;
 const areas=await loadAreas();
 type.innerHTML=accessLabels.map(x=>`<option value="${x}">${x}</option>`).join('');
 area.innerHTML=(areas.length?areas.map(a=>`<option value="${esc(a.name)}">${esc(a.name)}</option>`).join(''):'')+`<option value="${unassignedLabel}">${unassignedLabel}</option>`;
 if(barangay)barangay.innerHTML='<option value="">Select barangay</option>'+santaMariaLagunaBarangays.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 const existingType=existing?.memberType||existing?.access||'Member';
 type.value=accessLabels.includes(existingType)?existingType:'Member';
 const parsed=splitAddress(existing?.address||'');
 if(mode)mode.value=parsed.mode;
 if(document.getElementById('mStreet'))document.getElementById('mStreet').value=parsed.street;
 if(document.getElementById('mOtherAddress'))document.getElementById('mOtherAddress').value=parsed.other;
 if(barangay)barangay.value=parsed.barangay;
 const existingArea=existing?.area||'';
 if(existingArea&&[...area.options].some(o=>o.value===existingArea))area.value=existingArea;
 const apply=()=>{
  const needsArea=type.value==='Member'||type.value==='Area Leader';
  if(!needsArea)area.value=unassignedLabel;
  area.disabled=!needsArea;
  const local=mode?.value==='local';
  document.getElementById('mLocalAddressFields')?.classList.toggle('hidden',!local);
  document.getElementById('mOtherAddressFields')?.classList.toggle('hidden',local);
 };
 type.onchange=apply;mode&&(mode.onchange=apply);apply();
}
function installMemberModal(){
 if(window.__VCCF_MEMBER_ACCESS_MODAL_INSTALLED__)return;
 window.__VCCF_MEMBER_ACCESS_MODAL_INSTALLED__=true;
 window.memberModal=async function(existing=null){
  if(!canManageMembers()){toastMsg('You do not have permission to manage members.');return;}
  const modal=document.getElementById('modal'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
  if(!modal||!body){toastMsg('Member form is unavailable. Please refresh the page.');return;}
  title.textContent=existing?'Edit member':'Add member';
  const parsed=splitAddress(existing?.address||'');
  body.innerHTML=`<form id="memberForm"><div class="formgrid"><div class="field full"><label>Profile Picture</label><div class="profile-upload">${existing?.photo?`<img id="mPhotoPreview" class="profile-preview" src="${esc(existing.photo)}" alt="Profile preview">`:`<div id="mPhotoPreview" class="profile-preview" style="display:grid;place-items:center;color:var(--muted);font-size:1.6rem">👤</div>`}<div><input id="mPhoto" type="file" accept="image/*"><small style="display:block;color:var(--muted);margin-top:5px">Optional. JPG, PNG or WebP up to 5 MB.</small></div></div></div><div class="field"><label>Name</label><input id="mName" value="${esc(existing?.name||'')}" required></div><div class="field"><label>Birthday (Optional)</label><input id="mBirth" type="date" value="${esc(existing?.birthday||'')}"></div><div class="field full"><label>Address type</label><select id="mAddressMode"><option value="local">Santa Maria, Laguna</option><option value="other">Other address</option></select></div><div id="mLocalAddressFields" class="field full"><div class="formgrid" style="padding:0"><div class="field"><label>House No. / Street (Optional)</label><input id="mStreet" value="${esc(parsed.street)}" placeholder="e.g. 123 Main St."></div><div class="field"><label>Barangay</label><select id="mBarangay"></select></div></div></div><div id="mOtherAddressFields" class="field full hidden"><label>Other address</label><textarea id="mOtherAddress" rows="3" placeholder="Enter the complete address">${esc(parsed.other)}</textarea></div><div class="field"><label>Area</label><select id="mArea"><option>Loading areas…</option></select></div><div class="field"><label>Access</label><select id="mAccess"></select></div></div><button class="btn" style="width:100%">Save member</button></form>`;
  try{await renderAccessForm(existing)}catch(err){const a=document.getElementById('mArea');if(a)a.innerHTML=`<option value="${unassignedLabel}">${unassignedLabel}</option>`;toastMsg('Unable to load areas. Please try again.');console.warn('VCCF areas:',err)}
  modal.classList.add('open');
  document.getElementById('mPhoto')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const p=document.getElementById('mPhotoPreview');if(p)p.outerHTML=`<img id="mPhotoPreview" class="profile-preview" src="${r.result}" alt="Profile preview">`};r.readAsDataURL(f)});
  document.getElementById('memberForm').onsubmit=async e=>{e.preventDefault();try{await saveMemberFromForm(existing);modal.classList.remove('open');if(typeof loadDb==='function')await loadDb();if(typeof refresh==='function')refresh();toastMsg(existing?'Member updated.':'Member added.')}catch(err){console.error('VCCF member save:',err);toastMsg(err.message||'Unable to save member.')}};
 };
}
function installAddButton(){
 const button=document.getElementById('addMemberBtn');
 if(!button||button.dataset.vccfAddAccessV3)return;
 button.dataset.vccfAddAccessV3='1';
 button.hidden=false;
 button.classList.remove('hidden');
 button.disabled=false;
 const existingOnclick=button.getAttribute('onclick');
 if(existingOnclick)button.removeAttribute('onclick');
 button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.memberModal?.();},{capture:true});
}
function boot(){installMemberModal();installAddButton();setTimeout(()=>{installMemberModal();installAddButton()},500);window.addEventListener('vccf-app-ready',()=>{installMemberModal();installAddButton()});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
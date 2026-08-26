(()=>{
'use strict';
if(window.__VCCF_MEMBER_ACCESS_V4__)return;
window.__VCCF_MEMBER_ACCESS_V4__=true;
const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const accessLabels=['Member','Guest','Area Leader','Pastor','Admin'];
const unassignedLabel='No Designated Area';
const santaMariaBarangays=['Bagbaguin','Balasing','Buenavista','Bulac','Camangyanan','Catmon','Cay Pombo','Caysio','Guyong','Lalakhan','Mag-asawang Sapa','Mahabang Parang','Manggahan','Parada','Poblacion','Pulong Buhangin','San Gabriel','San Jose Patag','San Vicente','Sta. Clara','Sta. Cruz','Silangan','Tabing Bakod','Tumana'];
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const toastMsg=m=>{if(typeof toast==='function')toast(m);else{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500);}}};
function areaIdByName(name){return ((typeof db!=='undefined'?db.areas:[])||[]).find(a=>a.name===name)?.id||null;}
function ensureAddModal(){
 let modal=document.getElementById('vccfAddMemberModal');
 if(modal)return modal;
 modal=document.createElement('div');modal.id='vccfAddMemberModal';modal.className='modal';modal.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>Add member</h3><button type="button" class="close" id="vccfAddMemberClose">×</button></div><form id="vccfAddMemberForm"><div class="formgrid"><div class="field"><label>Name</label><input id="vccfAddName" required></div><div class="field"><label>Birthday (Optional)</label><input id="vccfAddBirth" type="date"></div><div class="field full"><label>House No. / Street (Optional)</label><input id="vccfAddStreet" placeholder="e.g. 123 Main St."></div><div class="field full"><label>Barangay (Santa Maria, Bulacan)</label><select id="vccfAddBarangay" required></select></div><div class="field full"><label>Profile picture</label><div class="profile-upload"><img id="vccfAddPhotoPreview" class="profile-preview" alt="Profile preview"><div style="flex:1"><input id="vccfAddPhoto" type="file" accept="image/*"><div style="font-size:.76rem;color:var(--muted);margin-top:6px">Optional. JPG, PNG or WebP up to 5 MB.</div></div></div></div><div class="field"><label>Area</label><select id="vccfAddArea"></select></div><div class="field"><label>Access</label><select id="vccfAddAccess"></select></div></div><button id="vccfAddSave" class="btn" style="width:100%" type="submit">Save member</button></form></div>`;
 document.body.appendChild(modal);
 document.getElementById('vccfAddMemberClose').onclick=()=>modal.classList.remove('open');
 modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
 document.getElementById('vccfAddMemberForm').onsubmit=saveNewMember;
 document.getElementById('vccfAddPhoto').onchange=previewPhoto;
 return modal;
}
function initials(name){return String(name||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';}
function resetPhotoPreview(){const img=document.getElementById('vccfAddPhotoPreview');if(!img)return;img.src='';img.style.display='none';img.alt='No profile picture selected';}
function previewPhoto(e){const file=e.target.files?.[0];if(!file){resetPhotoPreview();return;}if(!file.type.startsWith('image/')){e.target.value='';resetPhotoPreview();toastMsg('Please select an image file.');return;}if(file.size>5*1024*1024){e.target.value='';resetPhotoPreview();toastMsg('Profile picture must be 5 MB or smaller.');return;}const reader=new FileReader();reader.onload=()=>{const img=document.getElementById('vccfAddPhotoPreview');if(img){img.src=reader.result;img.style.display='block';}};reader.readAsDataURL(file);}
function syncAddModalOptions(){
 const area=document.getElementById('vccfAddArea'),access=document.getElementById('vccfAddAccess'),barangay=document.getElementById('vccfAddBarangay');if(!area||!access||!barangay)return;
 barangay.innerHTML='<option value="">Select barangay</option>'+santaMariaBarangays.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 area.innerHTML=((typeof db!=='undefined'?db.areas:[])||[]).map(a=>`<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('')+`<option value="${unassignedLabel}">${unassignedLabel}</option>`;
 access.innerHTML=accessLabels.map(x=>`<option value="${x}">${x}</option>`).join('');
 const apply=()=>{const needsArea=['Member','Area Leader'].includes(access.value);if(!needsArea)area.value=unassignedLabel;area.disabled=!needsArea;};
 access.onchange=apply;apply();
}
async function uploadMemberPhoto(file){
 if(!file)return null;
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
 const path=`members/${crypto.randomUUID()}-${safeName}`;
 const up=await client.storage.from('vccf-gallery').upload(path,file,{upsert:false,contentType:file.type});
 if(up.error)throw up.error;
 const pub=client.storage.from('vccf-gallery').getPublicUrl(path).data?.publicUrl||null;
 if(!pub){try{await client.storage.from('vccf-gallery').remove([path]);}catch(_){}};
 return pub?{path,url:pub}:null;
}
async function saveNewMember(e){
 e.preventDefault();
 const btn=document.getElementById('vccfAddSave');if(btn)btn.disabled=true;
 let uploaded=null;
 try{
  const fullName=document.getElementById('vccfAddName').value.trim();
  const street=document.getElementById('vccfAddStreet').value.trim();
  const barangay=document.getElementById('vccfAddBarangay').value;
  const birthday=document.getElementById('vccfAddBirth').value||null;
  const type=document.getElementById('vccfAddAccess').value;
  const areaName=document.getElementById('vccfAddArea').value;
  const file=document.getElementById('vccfAddPhoto')?.files?.[0]||null;
  if(!fullName)throw new Error('Name is required.');
  if(!barangay)throw new Error('Please select a barangay.');
  const area_id=['Member','Area Leader'].includes(type)?areaIdByName(areaName):null;
  if(['Member','Area Leader'].includes(type)&&!area_id)throw new Error(type+' members should have a designated area.');
  const address=[street,barangay,'Santa Maria, Bulacan'].filter(Boolean).join(', ');
  uploaded=await uploadMemberPhoto(file);
  const parts=fullName.split(/\s+/);const first_name=parts.shift()||fullName;const last_name=parts.join(' ')||'';
  const payload={first_name,last_name,display_name:fullName,address,birth_date:birthday,area_id,member_type:type,photo_url:uploaded?.url||null};
  const {data,error}=await client.from('members').insert(payload).select('id,member_code,display_name,member_type,area_id,address,birth_date,photo_url').single();
  if(error){if(uploaded?.path)await client.storage.from('vccf-gallery').remove([uploaded.path]);throw error;}
  document.getElementById('vccfAddMemberModal')?.classList.remove('open');
  if(typeof loadDb==='function')await loadDb();
  if(typeof refresh==='function')refresh();
  if(typeof window.vccfRepairMembers==='function')window.vccfRepairMembers(100);
  toastMsg(`Member ${data?.display_name||fullName} added successfully.`);
 }catch(err){console.error('VCCF add member:',err);toastMsg(err?.message||'Unable to add member.');}
 finally{if(btn)btn.disabled=false;}
}
function openAddMember(){
 if(typeof allowedWrite==='function'&&!allowedWrite())return;
 const modal=ensureAddModal();
 syncAddModalOptions();
 document.getElementById('vccfAddName').value='';document.getElementById('vccfAddBirth').value='';document.getElementById('vccfAddStreet').value='';document.getElementById('vccfAddBarangay').value='';document.getElementById('vccfAddPhoto').value='';resetPhotoPreview();
 modal.classList.add('open');
 document.getElementById('vccfAddName')?.focus();
}
function installAddButton(){
 const btn=document.getElementById('addMemberBtn');if(!btn||btn.dataset.vccfAddPatched==='4')return;
 btn.dataset.vccfAddPatched='4';btn.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();openAddMember();};
}
async function syncMemberTypes(){
 if(typeof db==='undefined'||!Array.isArray(db.members))return;
 const {data}=await client.from('members').select('id,member_type,area_id,photo_url,address,birth_date');
 const byId=new Map((data||[]).map(m=>[String(m.id),m]));
 db.members.forEach(m=>{const row=byId.get(String(m.id));if(!row)return;m.memberType=row.member_type||m.memberType||'Member';m.access=m.memberType;if(row.area_id===null)m.area=unassignedLabel;if(row.photo_url!==undefined){m.photo_url=row.photo_url||'';m.photoUrl=row.photo_url||'';m.photo=row.photo_url||'';}if(row.address!==undefined)m.address=row.address||'';if(row.birth_date!==undefined){m.birth_date=row.birth_date;m.birthDate=row.birth_date;}});
}
function installLoadDbPatch(){
 if(typeof window.loadDb!=='function'||window.__VCCF_MEMBER_ACCESS_LOADDB_V4__)return;
 window.__VCCF_MEMBER_ACCESS_LOADDB_V4__=true;
 const original=window.loadDb;
 window.loadDb=async function(){await original.apply(this,arguments);await syncMemberTypes();};
}
function installAreaPatch(){
 if(typeof window.areaMembers!=='function'||window.__VCCF_MEMBER_ACCESS_AREA_PATCH_V4__)return;
 window.__VCCF_MEMBER_ACCESS_AREA_PATCH_V4__=true;
 const original=window.areaMembers;
 window.areaMembers=function(){
  const list=original.apply(this,arguments);
  if(typeof session!=='undefined'&&session.role==='Area Leader'&&!session.areaId)return typeof db!=='undefined'?db.members:[];
  return list;
 };
}
function boot(){
 installAddButton();installLoadDbPatch();installAreaPatch();
 setTimeout(()=>{installAddButton();installLoadDbPatch();installAreaPatch();},300);
 window.addEventListener('vccf-app-ready',()=>{installAddButton();installLoadDbPatch();installAreaPatch();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

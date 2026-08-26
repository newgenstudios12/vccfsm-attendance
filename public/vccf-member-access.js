(()=>{
'use strict';
if(window.__VCCF_MEMBER_ACCESS_V1__)return;
window.__VCCF_MEMBER_ACCESS_V1__=true;
const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const accessLabels=['Member','Guest','Area Leader','Pastor','Admin'];
const unassignedLabel='No Designated Area';
const santaMariaLagunaBarangays=['Adia','Bagong Pook','Bagumbayan','Bubukal','Cabooan','Calangay','Cambuja','Coralan','Cueva','Inayapan','Jose Laurel, Sr.','Kayhakat','Macasipac','Masinao','Mataling-Ting','Pao-o','Parang Ng Buho','Barangay I','Barangay II','Barangay III','Barangay IV','Jose Rizal','Santiago','Talangka','Tungkod'];
const toastMsg=m=>{if(typeof toast==='function')toast(m);else{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500);}}};
const areaIdByName=name=>((typeof db!=='undefined'?db.areas:[])||[]).find(a=>a.name===name)?.id||null;
function syncMemberTypes(){
 if(typeof db==='undefined'||!Array.isArray(db.members))return Promise.resolve();
 return client.from('members').select('id,member_type,area_id,address,birth_date,photo_url').then(({data})=>{
  const byId=new Map((data||[]).map(m=>[String(m.id),m]));
  db.members.forEach(m=>{const row=byId.get(String(m.id));if(!row)return;m.memberType=row.member_type||m.memberType||'Member';m.access=m.memberType;if(row.area_id===null)m.area=unassignedLabel;if(row.address!==undefined)m.address=row.address||'';if(row.birth_date!==undefined){m.birthday=row.birth_date;m.birth_date=row.birth_date;}if(row.photo_url!==undefined){m.photo=row.photo_url||'';m.photo_url=row.photo_url||'';}});
 });
}
function installLoadDbPatch(){
 if(typeof window.loadDb!=='function'||window.__VCCF_MEMBER_ACCESS_LOADDB__)return;
 window.__VCCF_MEMBER_ACCESS_LOADDB__=true;
 const original=window.loadDb;
 window.loadDb=async function(){await original.apply(this,arguments);await syncMemberTypes();};
}
function installAreaPatch(){
 if(typeof window.areaMembers!=='function'||window.__VCCF_MEMBER_ACCESS_AREA_PATCH__)return;
 window.__VCCF_MEMBER_ACCESS_AREA_PATCH__=true;
 window.areaMembers=function(){if(typeof session==='undefined')return typeof db!=='undefined'?db.members:[];if(session.role==='Area Leader'){if(!session.areaId)return typeof db!=='undefined'?db.members:[];return db.members.filter(m=>m.areaId===session.areaId||m.area===session.area);}if(session.role==='Member')return db.members.filter(m=>m.id===session.memberId);return db.members;};
}
function installCheckinPatch(){
 if(typeof window.checkin!=='function'||window.__VCCF_MEMBER_ACCESS_CHECKIN_PATCH__)return;
 window.__VCCF_MEMBER_ACCESS_CHECKIN_PATCH__=true;
 const original=window.checkin;
 window.checkin=async function(id){if(typeof session!=='undefined'&&session.role==='Area Leader'&&session.__noArea){const previousRole=session.role;session.role='Admin';try{return await original(id)}finally{session.role=previousRole;}}return original(id);};
}
function splitAddress(raw){
 const s=String(raw||'').trim();
 const suffix=', Santa Maria, Laguna';
 if(s.endsWith(suffix)){
  const body=s.slice(0,-suffix.length).trim();
  const parts=body.split(',');
  const barangay=parts.pop()?.trim()||'';
  return {street:parts.join(',').trim(),barangay};
 }
 return {street:s,barangay:''};
}
async function saveMemberFromForm(existing){
 const fullName=document.getElementById('mName').value.trim();
 const parts=fullName.split(/\s+/);const first_name=parts.shift()||fullName;const last_name=parts.join(' ')||'';
 const birthday=document.getElementById('mBirth').value||null;
 const type=document.getElementById('mAccess').value;
 const areaValue=document.getElementById('mArea').value;
 const area_id=areaValue===unassignedLabel?null:areaIdByName(areaValue);
 const street=document.getElementById('mStreet')?.value.trim()||'';
 const barangay=document.getElementById('mBarangay')?.value||'';
 const file=document.getElementById('mPhoto')?.files?.[0];
 let photo=existing?.photo||existing?.photo_url||'';
 if(file){
  if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');
  if(file.size>5*1024*1024)throw new Error('Profile picture must be 5 MB or smaller.');
  photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=320,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78));};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)});
 }
 if(!fullName)throw new Error('Name is required.');
 if(!barangay)throw new Error('Please select a barangay.');
 if((type==='Member'||type==='Area Leader')&&!area_id)throw new Error(type+' members should have a designated area.');
 const address=[street,barangay,'Santa Maria, Laguna'].filter(Boolean).join(', ');
 const payload={first_name,last_name,birth_date:birthday,address,area_id,photo_url:photo||null,member_type:type,updated_at:new Date().toISOString()};
 const r=existing?await client.from('members').update(payload).eq('id',existing.id):await client.from('members').insert({...payload,display_name:fullName}).select('id').single();
 if(r.error)throw r.error;
}
function renderAccessForm(existing){
 const type=document.getElementById('mAccess'),area=document.getElementById('mArea'),barangay=document.getElementById('mBarangay');
 if(!type||!area)return;
 type.innerHTML=accessLabels.map(x=>`<option>${x}</option>`).join('');
 area.innerHTML=(typeof db!=='undefined'?db.areas:[]).map(a=>`<option>${esc(a.name)}</option>`).join('')+`<option>${unassignedLabel}</option>`;
 if(barangay){barangay.innerHTML='<option value="">Select barangay</option>'+santaMariaLagunaBarangays.map(x=>`<option>${esc(x)}</option>`).join('');}
 type.value=existing?.memberType||existing?.access||'Member';
 const parsed=splitAddress(existing?.address||'');
 if(barangay)barangay.value=parsed.barangay;
 const apply=()=>{const needsArea=type.value==='Member'||type.value==='Area Leader';if(!needsArea)area.value=unassignedLabel;area.disabled=!needsArea;area.title=needsArea?'A designated area is required for this access level.':'No designated area is allowed for this access level.';};
 type.onchange=apply;apply();
}
function installMemberModalPatch(){
 if(typeof window.memberModal!=='function'||window.__VCCF_MEMBER_ACCESS_MODAL_PATCH__)return;
 window.__VCCF_MEMBER_ACCESS_MODAL_PATCH__=true;
 window.memberModal=async function(existing=null){
  if(typeof allowedWrite==='function'&&!allowedWrite())return;
  const modal=document.getElementById('modal'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');if(!modal||!body)return;
  title.textContent=existing?'Edit member':'Add member';
  const parsed=splitAddress(existing?.address||'');
  body.innerHTML=`<form id="memberForm"><div class="formgrid"><div class="field full"><label>Profile Picture</label><div class="profile-upload">${existing?.photo?`<img id="mPhotoPreview" class="profile-preview" src="${esc(existing.photo)}" alt="Profile preview">`:`<div id="mPhotoPreview" class="profile-preview" style="display:grid;place-items:center;color:var(--muted);font-size:1.6rem">👤</div>`}<div><input id="mPhoto" type="file" accept="image/*"><small style="display:block;color:var(--muted);margin-top:5px">Optional. JPG, PNG or WebP up to 5 MB.</small></div></div></div><div class="field"><label>Name</label><input id="mName" value="${esc(existing?.name||'')}" required></div><div class="field"><label>Birthday (Optional)</label><input id="mBirth" type="date" value="${esc(existing?.birthday||'')}"></div><div class="field full"><label>House No. / Street (Optional)</label><input id="mStreet" value="${esc(parsed.street)}" placeholder="e.g. 123 Main St."></div><div class="field full"><label>Barangay (Santa Maria, Laguna)</label><select id="mBarangay" required></select></div><div class="field"><label>Area</label><select id="mArea"></select></div><div class="field"><label>Access</label><select id="mAccess"></select></div></div><button class="btn" style="width:100%">Save member</button></form>`;
  renderAccessForm(existing);
  modal.classList.add('open');
  document.getElementById('mPhoto')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const p=document.getElementById('mPhotoPreview');if(p)p.outerHTML=`<img id="mPhotoPreview" class="profile-preview" src="${r.result}" alt="Profile preview">`};r.readAsDataURL(f)});
  document.getElementById('memberForm').onsubmit=async e=>{e.preventDefault();try{await saveMemberFromForm(existing);modal.classList.remove('open');await loadDb();if(typeof refresh==='function')refresh();toastMsg(existing?'Member updated.':'Member added.')}catch(err){console.error('VCCF member save:',err);toastMsg(err.message||'Unable to save member.')}};
 };
}
function installMemberRowPatch(){
 if(typeof window.renderMembers!=='function'||window.__VCCF_MEMBER_ACCESS_ROWS_PATCH__)return;
 window.__VCCF_MEMBER_ACCESS_ROWS_PATCH__=true;
 const original=window.renderMembers;
 window.renderMembers=function(){original();document.querySelectorAll('#memberRows tr').forEach(row=>{const nameCell=row.querySelector('td:first-child b');const name=nameCell?.textContent?.trim();const m=(typeof db!=='undefined'?db.members:[]).find(x=>x.name===name);if(m){const cells=row.querySelectorAll('td');if(cells[4])cells[4].textContent=m.access||m.memberType||'Member';}});};
}
function installAccountRoleHints(){
 const select=document.getElementById('aRole'),memberSelect=document.getElementById('aMember');if(!select||!memberSelect||select.dataset.vccfAccessPatched)return;select.dataset.vccfAccessPatched='1';if(![...select.options].some(o=>o.value==='guest'))select.insertAdjacentHTML('beforeend','<option value="guest">Guest</option><option value="pastor">Pastor</option>');const sync=()=>{const id=memberSelect.value;if(!id||typeof db==='undefined')return;const m=db.members.find(x=>x.id===id);if(m?.memberType==='Guest')select.value='guest';else if(m?.memberType==='Pastor')select.value='pastor'};memberSelect.addEventListener('change',sync);sync();
}
function boot(){installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints();setTimeout(()=>{installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints()},500);window.addEventListener('vccf-app-ready',()=>{installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints()});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
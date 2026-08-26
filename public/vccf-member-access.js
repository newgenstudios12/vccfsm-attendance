(()=>{
'use strict';
if(window.__VCCF_MEMBER_ACCESS_V3__)return;
window.__VCCF_MEMBER_ACCESS_V3__=true;
const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const accessLabels=['Member','Guest','Area Leader','Pastor','Admin'];
const unassignedLabel='No Designated Area';
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const toastMsg=m=>{if(typeof toast==='function')toast(m);else{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500);}}};
function areaIdByName(name){return ((typeof db!=='undefined'?db.areas:[])||[]).find(a=>a.name===name)?.id||null;}
function ensureAddModal(){
 let modal=document.getElementById('vccfAddMemberModal');
 if(modal)return modal;
 modal=document.createElement('div');modal.id='vccfAddMemberModal';modal.className='modal';modal.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>Add member</h3><button type="button" class="close" id="vccfAddMemberClose">×</button></div><form id="vccfAddMemberForm"><div class="formgrid"><div class="field"><label>Name</label><input id="vccfAddName" required></div><div class="field"><label>Birthday (Optional)</label><input id="vccfAddBirth" type="date"></div><div class="field full"><label>Address</label><input id="vccfAddAddress" required></div><div class="field"><label>Area</label><select id="vccfAddArea"></select></div><div class="field"><label>Access</label><select id="vccfAddAccess"></select></div></div><button id="vccfAddSave" class="btn" style="width:100%" type="submit">Save member</button></form></div>`;
 document.body.appendChild(modal);
 document.getElementById('vccfAddMemberClose').onclick=()=>modal.classList.remove('open');
 modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
 document.getElementById('vccfAddMemberForm').onsubmit=saveNewMember;
 return modal;
}
function syncAddModalOptions(){
 const area=document.getElementById('vccfAddArea'),access=document.getElementById('vccfAddAccess');if(!area||!access)return;
 area.innerHTML=((typeof db!=='undefined'?db.areas:[])||[]).map(a=>`<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('')+`<option value="${unassignedLabel}">${unassignedLabel}</option>`;
 access.innerHTML=accessLabels.map(x=>`<option value="${x}">${x}</option>`).join('');
 const apply=()=>{const needsArea=['Member','Area Leader'].includes(access.value);if(!needsArea)area.value=unassignedLabel;area.disabled=!needsArea;};
 access.onchange=apply;apply();
}
async function saveNewMember(e){
 e.preventDefault();
 const btn=document.getElementById('vccfAddSave');if(btn)btn.disabled=true;
 try{
  const fullName=document.getElementById('vccfAddName').value.trim();
  const address=document.getElementById('vccfAddAddress').value.trim();
  const birthday=document.getElementById('vccfAddBirth').value||null;
  const type=document.getElementById('vccfAddAccess').value;
  const areaName=document.getElementById('vccfAddArea').value;
  if(!fullName)throw new Error('Name is required.');
  if(!address)throw new Error('Address is required.');
  const area_id=['Member','Area Leader'].includes(type)?areaIdByName(areaName):null;
  if(['Member','Area Leader'].includes(type)&&!area_id)throw new Error(type+' members should have a designated area.');
  const parts=fullName.split(/\s+/);const first_name=parts.shift()||fullName;const last_name=parts.join(' ')||'';
  const payload={first_name,last_name,display_name:fullName,address,birth_date:birthday,area_id,member_type:type,photo_url:null};
  const {data,error}=await client.from('members').insert(payload).select('id,member_code,display_name,member_type,area_id,address,birth_date').single();
  if(error)throw error;
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
 document.getElementById('vccfAddName').value='';document.getElementById('vccfAddBirth').value='';document.getElementById('vccfAddAddress').value='';
 modal.classList.add('open');
 document.getElementById('vccfAddName')?.focus();
}
function installAddButton(){
 const btn=document.getElementById('addMemberBtn');if(!btn||btn.dataset.vccfAddPatched==='3')return;
 btn.dataset.vccfAddPatched='3';btn.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();openAddMember();};
}
async function syncMemberTypes(){
 if(typeof db==='undefined'||!Array.isArray(db.members))return;
 const {data}=await client.from('members').select('id,member_type,area_id');
 const byId=new Map((data||[]).map(m=>[m.id,m]));
 db.members.forEach(m=>{const row=byId.get(m.id);m.memberType=row?.member_type||m.memberType||'Member';m.access=m.memberType;if(row?.area_id===null)m.area=unassignedLabel;});
}
function installLoadDbPatch(){
 if(typeof window.loadDb!=='function'||window.__VCCF_MEMBER_ACCESS_LOADDB_V3__)return;
 window.__VCCF_MEMBER_ACCESS_LOADDB_V3__=true;
 const original=window.loadDb;
 window.loadDb=async function(){await original.apply(this,arguments);await syncMemberTypes();};
}
function installAreaPatch(){
 if(typeof window.areaMembers!=='function'||window.__VCCF_MEMBER_ACCESS_AREA_PATCH_V3__)return;
 window.__VCCF_MEMBER_ACCESS_AREA_PATCH_V3__=true;
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

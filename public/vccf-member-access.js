(()=>{
'use strict';
if(window.__VCCF_MEMBER_ACCESS_V1__)return;
window.__VCCF_MEMBER_ACCESS_V1__=true;

const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const accessLabels=['Member','Guest','Area Leader','Pastor','Admin'];
const unassignedLabel='No Designated Area';
const roleToAccess=role=>role==='pastor'?'Area Leader':role==='guest'?'Member':role==='admin'?'Admin':'Member';

async function syncMemberTypes(){
  if(typeof db==='undefined'||!Array.isArray(db.members))return;
  const {data}=await client.from('members').select('id,member_type,area_id');
  const byId=new Map((data||[]).map(m=>[m.id,m]));
  db.members.forEach(m=>{
    const row=byId.get(m.id);
    m.memberType=row?.member_type||m.memberType||'Member';
    m.access=m.memberType;
    if(row?.area_id===null)m.area=unassignedLabel;
  });
}

function installLoadDbPatch(){
  if(typeof window.loadDb!=='function' || window.__VCCF_MEMBER_ACCESS_LOADDB__)return;
  window.__VCCF_MEMBER_ACCESS_LOADDB__=true;
  const originalLoadDb=window.loadDb;
  window.loadDb=async function(){
    await originalLoadDb.apply(this,arguments);
    await syncMemberTypes();
    try{
      const {data:{user}}=await client.auth.getUser();
      if(user && typeof session!=='undefined'){
        const {data:p}=await client.from('profiles').select('role,area_id,member_id,display_name').eq('user_id',user.id).maybeSingle();
        if(p?.role==='pastor'){
          session.role='Area Leader';
          session.__memberAccessType='Pastor';
          session.__noArea=!p.area_id;
        }else if(p?.role==='guest'){
          session.role='Member';
          session.__memberAccessType='Guest';
          session.__noArea=!p.area_id;
        }
        if(p){session.areaId=p.area_id||null;session.area=(typeof db!=='undefined'?db.areas.find(a=>a.id===p.area_id)?.name:'')||'';}
      }
    }catch(e){console.warn('VCCF member access role sync failed:',e)}
  };
}

function installAreaPatch(){
  if(typeof window.areaMembers!=='function'||window.__VCCF_MEMBER_ACCESS_AREA_PATCH__)return;
  window.__VCCF_MEMBER_ACCESS_AREA_PATCH__=true;
  window.areaMembers=function(){
    if(typeof session==='undefined')return typeof db!=='undefined'?db.members:[];
    if(session.role==='Area Leader'){
      if(!session.areaId)return typeof db!=='undefined'?db.members:[];
      return db.members.filter(m=>m.areaId===session.areaId||m.area===session.area);
    }
    if(session.role==='Member')return db.members.filter(m=>m.id===session.memberId);
    return db.members;
  };
}

function installCheckinPatch(){
  if(typeof window.checkin!=='function'||window.__VCCF_MEMBER_ACCESS_CHECKIN_PATCH__)return;
  window.__VCCF_MEMBER_ACCESS_CHECKIN_PATCH__=true;
  const originalCheckin=window.checkin;
  window.checkin=async function(id){
    if(typeof session!=='undefined'&&session.role==='Area Leader'&&session.__noArea){
      const previousRole=session.role;
      session.role='Admin';
      try{return await originalCheckin(id)}finally{session.role=previousRole;}
    }
    return originalCheckin(id);
  };
}

async function saveMemberFromForm(existing){
  const fullName=document.getElementById('mName').value.trim();
  const parts=fullName.split(/\s+/);const first_name=parts.shift()||fullName;const last_name=parts.join(' ')||'';
  const birthday=document.getElementById('mBirth').value||null;
  const type=document.getElementById('mAccess').value;
  const areaValue=document.getElementById('mArea').value;
  const area_id=areaValue===unassignedLabel?null:((typeof db!=='undefined'?db.areas:[]).find(a=>a.name===areaValue)||{}).id||null;
  const file=document.getElementById('mPhoto')?.files?.[0];
  let photo=existing?.photo||'';
  if(file){
    if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');
    photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=320,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)});
  }
  if((type==='Member'||type==='Area Leader')&&!area_id)throw new Error(type+' members should have a designated area.');
  const payload={first_name,last_name,birth_date:birthday,area_id,photo_url:photo||null,member_type:type,updated_at:new Date().toISOString()};
  const r=existing?await client.from('members').update(payload).eq('id',existing.id):await client.from('members').insert({...payload}).select('id').single();
  if(r.error)throw r.error;
}

function renderAccessForm(existing){
  const type=document.getElementById('mAccess');const area=document.getElementById('mArea');if(!type||!area)return;
  if(![...type.options].some(o=>o.value==='Guest')){
    type.innerHTML=accessLabels.map(x=>`<option>${x}</option>`).join('');
  }
  if(![...area.options].some(o=>o.value===unassignedLabel)){
    area.insertAdjacentHTML('beforeend',`<option>${unassignedLabel}</option>`);
  }
  type.value=existing?.memberType||existing?.access||'Member';
  area.value=existing?.area||((type.value==='Admin'||type.value==='Guest'||type.value==='Pastor')?unassignedLabel:'');
  const apply=()=>{
    const needsArea=type.value==='Member'||type.value==='Area Leader';
    if(type.value==='Admin'||type.value==='Guest'||type.value==='Pastor')area.value=unassignedLabel;
    area.disabled=!needsArea;
    area.title=needsArea?'A designated area is required for this access level.':'No designated area is allowed for this access level.';
  };
  type.onchange=apply;apply();
  const label=type.closest('.field')?.querySelector('label');if(label)label.textContent='Access';
}

function installMemberModalPatch(){
  if(typeof window.memberModal!=='function'||window.__VCCF_MEMBER_ACCESS_MODAL_PATCH__)return;
  window.__VCCF_MEMBER_ACCESS_MODAL_PATCH__=true;
  window.memberModal=async function(existing=null){
    if(typeof allowedWrite==='function'&&!allowedWrite())return;
    const modal=document.getElementById('modal'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
    if(!modal||!body)return;
    title.textContent=existing?'Edit member':'Add member';
    body.innerHTML=`<form id="memberForm"><div class="formgrid"><div class="field full"><label>Profile Picture</label><div class="profile-upload">${existing?.photo?`<img id="mPhotoPreview" class="profile-preview" src="${esc(existing.photo)}" alt="Profile preview">`:`<div id="mPhotoPreview" class="profile-preview" style="display:grid;place-items:center;color:var(--muted);font-size:1.6rem">👤</div>`}<div><input id="mPhoto" type="file" accept="image/*"><small style="display:block;color:var(--muted);margin-top:5px">Use a clear face photo.</small></div></div></div><div class="field"><label>Name</label><input id="mName" value="${esc(existing?.name||'')}" required></div><div class="field"><label>Birthday (Optional)</label><input id="mBirth" type="date" value="${esc(existing?.birthday||'')}"></div><div class="field full"><label>Address</label><input id="mAddress" value="${esc(existing?.address||'')}" required></div><div class="field"><label>Area</label><select id="mArea"></select></div><div class="field"><label>Access</label><select id="mAccess"></select></div></div><button class="btn" style="width:100%">Save member</button></form>`;
    const access=document.getElementById('mAccess'),area=document.getElementById('mArea');
    access.innerHTML=accessLabels.map(x=>`<option>${x}</option>`).join('');
    const areas=(typeof db!=='undefined'?db.areas:[]).map(a=>`<option>${esc(a.name)}</option>`).join('');
    area.innerHTML=areas+`<option>${unassignedLabel}</option>`;
    renderAccessForm(existing);modal.classList.add('open');
    document.getElementById('mPhoto')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const p=document.getElementById('mPhotoPreview');if(p)p.outerHTML=`<img id="mPhotoPreview" class="profile-preview" src="${r.result}" alt="Profile preview">`};r.readAsDataURL(f)});
    document.getElementById('memberForm').onsubmit=async e=>{e.preventDefault();try{await saveMemberFromForm(existing);modal.classList.remove('open');await loadDb();if(typeof refresh==='function')refresh();toast(existing?'Member updated.':'Member added.')}catch(err){console.error(err);toast(err.message||'Unable to save member.')}};
  };
}

function installMemberRowPatch(){
  if(typeof window.renderMembers!=='function'||window.__VCCF_MEMBER_ACCESS_ROWS_PATCH__)return;
  window.__VCCF_MEMBER_ACCESS_ROWS_PATCH__=true;
  const original=window.renderMembers;
  window.renderMembers=function(){original();document.querySelectorAll('#memberRows tr').forEach((row,idx)=>{const m=typeof db!=='undefined'?db.members[idx]:null;if(m){const cells=row.querySelectorAll('td');if(cells[4])cells[4].textContent=m.access||m.memberType||'Member';}})};
}

function installAccountRoleHints(){
  const select=document.getElementById('aRole'),memberSelect=document.getElementById('aMember');
  if(!select||!memberSelect||select.dataset.vccfAccessPatched)return;
  select.dataset.vccfAccessPatched='1';
  if(![...select.options].some(o=>o.value==='guest'))select.insertAdjacentHTML('beforeend','<option value="guest">Guest</option><option value="pastor">Pastor</option>');
  const sync=()=>{const id=memberSelect.value;if(!id||typeof db==='undefined')return;const m=db.members.find(x=>x.id===id);if(m?.memberType==='Guest')select.value='guest';else if(m?.memberType==='Pastor')select.value='pastor';};
  memberSelect.addEventListener('change',sync);sync();
}

function boot(){
  installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints();
  setTimeout(()=>{installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints();},500);
  window.addEventListener('vccf-app-ready',()=>{installLoadDbPatch();installAreaPatch();installCheckinPatch();installMemberModalPatch();installMemberRowPatch();installAccountRoleHints();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(()=>{
'use strict';
if(window.__VCCF_ADMIN_ACCOUNT_MANAGER_V2__)return;
window.__VCCF_ADMIN_ACCOUNT_MANAGER_V2__=true;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfAcctToast);window.__vccfAcctToast=setTimeout(()=>x.classList.remove('show'),2800)}};

async function invoke(action,body={}){
  const client=api();
  if(!client)throw new Error('Supabase is unavailable.');
  const {data,error}=await client.functions.invoke('manage-user',{body:{action,...body}});
  if(error)throw new Error(error.message||'Account service unavailable.');
  if(data?.error)throw new Error(data.error);
  return data;
}

async function isAdmin(client){
  const {data:{user}}=await client.auth.getUser();
  if(!user)return false;
  const {data,error}=await client.from('profiles').select('role').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return String(data?.role||'').toLowerCase()==='admin';
}

function addStyle(){
  if(document.getElementById('vccfAdminAccountManagerStyle'))return;
  const s=document.createElement('style');
  s.id='vccfAdminAccountManagerStyle';
  s.textContent=`
#vccfAdminAccountManager{margin-top:16px}
.vccf-ac-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.vccf-ac-toolbar input{flex:1 1 220px;min-width:0}
.vccf-ac-list{display:grid;gap:8px}
.vccf-ac-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
.vccf-ac-meta{min-width:0}.vccf-ac-meta b,.vccf-ac-meta span{overflow-wrap:anywhere}
.vccf-ac-sub{color:var(--muted);font-size:.8rem;margin-top:3px}
.vccf-ac-dialog{position:fixed;inset:0;z-index:500;display:none;place-items:center;padding:16px;background:rgba(0,0,0,.52)}
.vccf-ac-dialog.open{display:grid}
.vccf-ac-dialog-card{width:min(640px,100%);max-height:min(90dvh,760px);overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 22px 60px rgba(0,0,0,.28)}
.vccf-ac-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.vccf-ac-dialog-head h3{margin:0}
.vccf-ac-dialog-close{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:50%;width:36px;height:36px;font-size:20px;line-height:1}
.vccf-ac-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vccf-ac-form .full{grid-column:1/-1}.vccf-ac-form .field{min-width:0}
.vccf-ac-form input,.vccf-ac-form select{width:100%;min-width:0}
.vccf-ac-save{width:100%;margin-top:6px}
@media(max-width:600px){
.vccf-ac-form{grid-template-columns:1fr}.vccf-ac-form .full{grid-column:auto}
.vccf-ac-row{grid-template-columns:1fr}.vccf-ac-row .btn{width:100%}
.vccf-ac-dialog{padding:8px;align-items:end}.vccf-ac-dialog-card{max-height:calc(100dvh - 16px);padding:16px;border-radius:18px}
}
`;
  document.head.appendChild(s);
}

function getDialog(){
  let d=document.getElementById('vccfAdminAccountDialog');
  if(d)return d;
  d=document.createElement('div');
  d.id='vccfAdminAccountDialog';
  d.className='vccf-ac-dialog';
  d.setAttribute('aria-hidden','true');
  d.innerHTML=`<div class="vccf-ac-dialog-card" role="dialog" aria-modal="true" aria-labelledby="vccfAcDialogTitle"><div class="vccf-ac-dialog-head"><h3 id="vccfAcDialogTitle">Edit Account</h3><button type="button" class="vccf-ac-dialog-close" id="vccfAcDialogClose" aria-label="Close">×</button></div><div id="vccfAcDialogBody"></div></div>`;
  document.body.appendChild(d);
  const close=()=>{d.classList.remove('open');d.setAttribute('aria-hidden','true')};
  d.querySelector('#vccfAcDialogClose').onclick=close;
  d.addEventListener('click',e=>{if(e.target===d)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.classList.contains('open'))close()});
  return d;
}

async function openEdit(ctx,onDone){
  const d=getDialog(),body=d.querySelector('#vccfAcDialogBody');
  body.innerHTML=`<form class="vccf-ac-form" id="vccfAcForm">
    <div class="field full"><label>Display name</label><input id="acName" value="${esc(ctx.user.display_name||'')}" autocomplete="name" required></div>
    <div class="field"><label>E-mail</label><input id="acEmail" type="email" value="${esc(ctx.user.email||'')}" autocomplete="username" required></div>
    <div class="field"><label>New password <span style="color:var(--muted);font-weight:500">(leave blank to keep)</span></label><input id="acPassword" type="password" minlength="8" autocomplete="new-password"></div>
    <div class="field"><label>Role</label><select id="acRole"><option value="member">Member</option><option value="area_leader">Area Leader</option><option value="admin">Admin</option><option value="guest">Guest</option><option value="pastor">Pastor</option></select></div>
    <div class="field"><label>Area</label><select id="acArea"><option value="">No area</option>${ctx.areas.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field full"><label>Linked member</label><select id="acMember"><option value="">No linked member</option>${ctx.members.filter(x=>x.is_active!==false&&String(x.status||'active').toLowerCase()!=='inactive').map(x=>`<option value="${esc(x.id)}">${esc(x.display_name||x.member_code||x.id)}${x.member_code?' · '+esc(x.member_code):''}</option>`).join('')}</select></div>
    <div class="full"><button type="submit" class="btn vccf-ac-save" id="acSave">Save Account Changes</button></div>
  </form>`;
  const roleSel=d.querySelector('#acRole'),areaSel=d.querySelector('#acArea');
  roleSel.value=ctx.user.role||'member';
  areaSel.value=ctx.user.area_id||'';
  d.querySelector('#acMember').value=ctx.user.member_id||'';
  roleSel.onchange=()=>{if(roleSel.value==='admin')areaSel.value=''};
  const close=()=>{d.classList.remove('open');d.setAttribute('aria-hidden','true')};
  d.classList.add('open');d.setAttribute('aria-hidden','false');
  d.querySelector('#acName').focus();
  d.querySelector('#vccfAcForm').onsubmit=async e=>{
    e.preventDefault();
    const save=d.querySelector('#acSave');save.disabled=true;save.textContent='Saving…';
    try{
      await invoke('update',{user_id:ctx.user.user_id,display_name:d.querySelector('#acName').value.trim(),email:d.querySelector('#acEmail').value.trim(),password:d.querySelector('#acPassword').value,role:roleSel.value,area_id:areaSel.value||null,member_id:d.querySelector('#acMember').value||null});
      close();toast('Account updated successfully.');await onDone();
    }catch(err){toast(err.message||'Unable to update account.')}finally{save.disabled=false;save.textContent='Save Account Changes'}
  };
}

async function render(){
  const v=document.getElementById('settings'),client=api();
  if(!v||!client||!v.classList.contains('active'))return;
  addStyle();
  if(!(await isAdmin(client))){document.getElementById('vccfAdminAccountManager')?.remove();return;}
  let host=document.getElementById('vccfAdminAccountManager');
  if(!host){
    host=document.createElement('section');host.id='vccfAdminAccountManager';
    host.innerHTML=`<div class="panel"><div class="vccf-ac-toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">Manage Accounts</h3><div class="vccf-ac-sub">Edit existing user accounts, roles, areas, member links, e-mail addresses, and passwords.</div></div><button type="button" class="btn secondary" id="vccfAcRefresh">Refresh</button></div><div class="vccf-ac-toolbar"><input id="vccfAcSearch" class="search" placeholder="Search accounts by name or e-mail" autocomplete="off"></div><div id="vccfAcList" class="vccf-ac-list"></div></div>`;
    const anchors=[...v.querySelectorAll('.panel')].filter(x=>x!==host);const anchor=anchors[anchors.length-1]||v.lastElementChild||v;anchor.insertAdjacentElement('afterend',host);
    host.querySelector('#vccfAcRefresh').onclick=()=>load();
    host.querySelector('#vccfAcSearch').oninput=()=>{clearTimeout(host.__searchTimer);host.__searchTimer=setTimeout(()=>load(),160)};
  }
  async function load(){
    if(!document.getElementById('vccfAdminAccountManager')||!v.classList.contains('active'))return;
    const list=host.querySelector('#vccfAcList');list.innerHTML='<div class="vccf-ac-sub">Loading accounts…</div>';
    try{
      const data=await invoke('list');host.__accounts=data.users||[];host.__areas=data.areas||[];host.__members=data.members||[];
      const term=host.querySelector('#vccfAcSearch')?.value.trim().toLowerCase()||'';
      const shown=host.__accounts.filter(u=>!term||String(u.display_name||'').toLowerCase().includes(term)||String(u.email||'').toLowerCase().includes(term));
      list.innerHTML=shown.length?shown.map(u=>`<div class="vccf-ac-row"><div class="vccf-ac-meta"><b>${esc(u.display_name||'Unnamed account')}</b><div class="vccf-ac-sub">${esc(u.email||'No e-mail')} · ${esc(u.role||'member')}${u.last_sign_in_at?' · Last sign-in '+esc(new Date(u.last_sign_in_at).toLocaleDateString('en-PH')):''}</div></div><button type="button" class="btn" data-ac-edit="${esc(u.user_id)}">Edit</button></div>`).join(''):'<div class="vccf-ac-sub">No matching accounts.</div>';
      list.querySelectorAll('[data-ac-edit]').forEach(btn=>btn.onclick=()=>{const user=host.__accounts.find(x=>String(x.user_id)===String(btn.dataset.acEdit));if(user)openEdit({user,areas:host.__areas,members:host.__members},load).catch(err=>toast(err.message||'Unable to open account editor.'))});
    }catch(err){list.innerHTML=`<div class="vccf-ac-sub">${esc(err.message||'Unable to load accounts.')}</div>`}
  }
  if(host.dataset.vccfLoaded!=='1'){host.dataset.vccfLoaded='1';await load()}
}

function watch(){
  const go=()=>{if(document.getElementById('settings')?.classList.contains('active'))render().catch(err=>console.warn('Account manager:',err))};
  go();
  document.addEventListener('click',e=>{if(e.target.closest?.('.nav button[data-view="settings"]'))setTimeout(go,120)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();

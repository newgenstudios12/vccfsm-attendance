(()=>{
'use strict';
if(window.__VCCF_MEMBER_MULTI_MINISTRY__)return;
window.__VCCF_MEMBER_MULTI_MINISTRY__=true;

const state=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor'].includes(role());
const todayPH=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let currentMemberId=null;
let scanTimer=0;
let summaryLoadedFor='';

function memberName(id){
  const m=(state().members||[]).find(x=>x.id===id);
  return m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
}

function addCss(){
  if(document.getElementById('vccfMultiMinistryCss'))return;
  const s=document.createElement('style');
  s.id='vccfMultiMinistryCss';
  s.textContent=`
  .vmm-overlay{position:fixed;inset:0;z-index:380;background:rgba(8,12,18,.56);display:grid;place-items:center;padding:16px}.vmm-card{width:min(780px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--card,#fff);color:var(--text,#15171c);border:1px solid var(--line,#e5e7eb);border-radius:20px;padding:18px}.vmm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.vmm-head h3{margin:0 0 5px}.vmm-close{width:42px;height:42px;border:1px solid var(--line);border-radius:12px;background:var(--bg,#f5f6f8);color:var(--text);font-size:1.25rem}.vmm-list{display:grid;gap:9px}.vmm-row{display:grid;grid-template-columns:minmax(180px,1.1fr) minmax(170px,1fr) 105px;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--bg,#f7f8fa)}.vmm-name{display:flex;align-items:center;gap:9px;font-weight:850}.vmm-name input{width:18px;height:18px}.vmm-role{width:100%;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--card,#fff);color:var(--text);padding:9px 10px}.vmm-primary{display:flex;align-items:center;gap:7px;font-size:.78rem;font-weight:800;color:var(--muted)}.vmm-primary input{width:17px;height:17px}.vmm-actions{display:flex;justify-content:flex-end;gap:8px;align-items:center;margin-top:15px}.vmm-msg{margin-right:auto;font-size:.8rem;color:#b42318}.vmm-chip-wrap{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.vmm-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:color-mix(in srgb,var(--brand,#d71920) 8%,transparent);border:1px solid color-mix(in srgb,var(--brand,#d71920) 18%,var(--line));font-size:.72rem;font-weight:800}.vmm-chip.primary:before{content:'★';color:var(--brand,#d71920)}
  @media(max-width:680px){.vmm-overlay{align-items:end;padding:8px}.vmm-card{max-height:calc(100dvh - 16px)}.vmm-row{grid-template-columns:1fr}.vmm-actions{display:grid;grid-template-columns:1fr 1fr}.vmm-msg{grid-column:1/-1;margin:0}.vmm-actions .btn{width:100%}}
  `;
  document.head.appendChild(s);
}

async function loadAssignments(memberId){
  const client=db();
  if(!client)throw new Error('Database unavailable.');
  const r=await client.from('member_ministries').select('id,ministry_id,role_title,joined_on,is_primary,ministries(name)').eq('member_id',memberId);
  if(r.error)throw r.error;
  return r.data||[];
}

async function refreshSummary(memberId,force=false){
  if(!memberId||(!force&&summaryLoadedFor===memberId))return;
  const ministryBox=[...document.querySelectorAll('.m360-summary')].find(x=>String(x.querySelector('h3')?.textContent||'').trim()==='Ministry');
  if(!ministryBox)return;
  try{
    const rows=await loadAssignments(memberId);
    if(currentMemberId!==memberId)return;
    summaryLoadedFor=memberId;
    const strong=ministryBox.querySelector('strong');
    const hint=ministryBox.querySelector('.hint');
    if(strong)strong.textContent=`${rows.length} assignment${rows.length===1?'':'s'}`;
    if(hint){
      hint.innerHTML=rows.length
        ? '<div class="vmm-chip-wrap">'+rows.slice().sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)).map(x=>'<span class="vmm-chip '+(x.is_primary?'primary':'')+'">'+esc(x.ministries?.name||'Ministry')+(x.role_title?' · '+esc(x.role_title):'')+'</span>').join('')+'</div>'
        : 'No ministry assignment';
    }
  }catch(e){console.warn('Ministry summary:',e)}
}

function syncRow(row){
  const checked=row.querySelector('[data-vmm-check]')?.checked;
  const roleInput=row.querySelector('[data-vmm-role]');
  const primary=row.querySelector('[data-vmm-primary]');
  if(roleInput)roleInput.disabled=!checked;
  if(primary){primary.disabled=!checked;if(!checked&&primary.checked)primary.checked=false;}
}

async function openManager(memberId){
  if(!canManage()||!memberId)return;
  addCss();
  document.getElementById('vmmOverlay')?.remove();
  const wrap=document.createElement('div');
  wrap.id='vmmOverlay';
  wrap.className='vmm-overlay';
  wrap.innerHTML='<div class="vmm-card"><div class="vmm-head"><div><h3>Manage Ministries</h3><div class="hint">'+esc(memberName(memberId))+' can belong to multiple ministries. Choose one primary ministry if needed.</div></div><button class="vmm-close" type="button" aria-label="Close">×</button></div><div id="vmmBody" class="empty">Loading ministries…</div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.querySelector('.vmm-close').onclick=close;
  wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
  const body=wrap.querySelector('#vmmBody');
  try{
    const client=db();
    const [mRes,aRes]=await Promise.all([
      client.from('ministries').select('id,name,is_active').eq('is_active',true).order('name'),
      client.from('member_ministries').select('id,ministry_id,role_title,joined_on,is_primary').eq('member_id',memberId)
    ]);
    if(mRes.error)throw mRes.error;if(aRes.error)throw aRes.error;
    const ministries=mRes.data||[], existing=aRes.data||[], byMin=new Map(existing.map(x=>[x.ministry_id,x]));
    body.className='';
    body.innerHTML='<form id="vmmForm"><div class="vmm-list">'+ministries.map(m=>{const x=byMin.get(m.id),on=Boolean(x);return '<div class="vmm-row" data-vmm-row="'+esc(m.id)+'"><label class="vmm-name"><input type="checkbox" data-vmm-check value="'+esc(m.id)+'" '+(on?'checked':'')+'><span>'+esc(m.name)+'</span></label><input class="vmm-role" data-vmm-role placeholder="Member, Leader, Coordinator" value="'+esc(x?.role_title||'')+'" '+(on?'':'disabled')+'><label class="vmm-primary"><input type="radio" name="vmmPrimary" data-vmm-primary value="'+esc(m.id)+'" '+(x?.is_primary?'checked':'')+' '+(on?'':'disabled')+'> Primary ministry</label></div>'}).join('')+'</div><div class="vmm-actions"><span id="vmmMsg" class="vmm-msg"></span><button class="btn secondary" type="button" data-vmm-cancel>Cancel</button><button class="btn" type="submit">Save Ministries</button></div></form>';
    const form=body.querySelector('#vmmForm');
    body.querySelectorAll('[data-vmm-row]').forEach(row=>{row.querySelector('[data-vmm-check]').addEventListener('change',()=>syncRow(row));syncRow(row)});
    body.querySelector('[data-vmm-cancel]').onclick=close;
    form.onsubmit=async e=>{
      e.preventDefault();
      const save=form.querySelector('button[type=submit]'),msg=form.querySelector('#vmmMsg');
      save.disabled=true;save.textContent='Saving…';msg.textContent='';
      try{
        const selected=[...form.querySelectorAll('[data-vmm-row]')].filter(row=>row.querySelector('[data-vmm-check]').checked).map(row=>({
          ministry_id:row.dataset.vmmRow,
          role_title:String(row.querySelector('[data-vmm-role]').value||'').trim()||null
        }));
        const selectedIds=new Set(selected.map(x=>x.ministry_id));
        const primary=form.querySelector('[name=vmmPrimary]:checked')?.value||null;
        const removed=existing.filter(x=>!selectedIds.has(x.ministry_id)).map(x=>x.ministry_id);

        const clear=await client.from('member_ministries').update({is_primary:false}).eq('member_id',memberId);
        if(clear.error)throw clear.error;
        if(removed.length){const del=await client.from('member_ministries').delete().eq('member_id',memberId).in('ministry_id',removed);if(del.error)throw del.error;}
        if(selected.length){
          const old=new Map(existing.map(x=>[x.ministry_id,x]));
          const payload=selected.map(x=>({member_id:memberId,ministry_id:x.ministry_id,role_title:x.role_title,joined_on:old.get(x.ministry_id)?.joined_on||todayPH(),is_primary:x.ministry_id===primary}));
          const up=await client.from('member_ministries').upsert(payload,{onConflict:'member_id,ministry_id'});
          if(up.error)throw up.error;
        }
        summaryLoadedFor='';
        await refreshSummary(memberId,true);
        window.dispatchEvent(new CustomEvent('vccf-ministry-memberships-updated',{detail:{memberId}}));
        msg.style.color='#167647';msg.textContent='Ministries saved.';
        setTimeout(close,350);
      }catch(err){msg.textContent=err?.message||'Unable to save ministries.';save.disabled=false;save.textContent='Save Ministries';}
    };
  }catch(err){body.className='';body.innerHTML='<div class="notice"><b>Unable to load ministries.</b><div style="margin-top:6px">'+esc(err?.message||err)+'</div></div>';}
}

function injectButton(){
  if(!canManage()||!currentMemberId)return;
  const actions=document.querySelector('.m360-head .member-detail-actions');
  if(!actions)return;
  if(!document.getElementById('vmmManageBtn')){
    const b=document.createElement('button');
    b.id='vmmManageBtn';b.className='btn secondary';b.type='button';b.textContent='Manage Ministries';
    b.onclick=()=>openManager(currentMemberId);
    const edit=document.getElementById('m360edit');
    if(edit)actions.insertBefore(b,edit);else actions.appendChild(b);
  }
  refreshSummary(currentMemberId);
}

function queueScan(delay=80){clearTimeout(scanTimer);scanTimer=setTimeout(injectButton,delay)}

document.addEventListener('click',e=>{
  const trigger=e.target.closest?.('[data-view-member],[data-member-id]');
  if(trigger){
    currentMemberId=trigger.dataset.viewMember||trigger.dataset.memberId||currentMemberId;
    summaryLoadedFor='';
    queueScan(180);
  }
  if(e.target.closest?.('#m360back')){currentMemberId=null;summaryLoadedFor='';}
},true);

const observer=new MutationObserver(records=>{
  if(!currentMemberId||!canManage())return;
  if(records.some(r=>r.addedNodes?.length))queueScan(90);
});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',()=>queueScan(500));
})();

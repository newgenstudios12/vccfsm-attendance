(()=>{
'use strict';
if(window.__VCCF_MEMBER_GIVING_V1__)return;
window.__VCCF_MEMBER_GIVING_V1__=true;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);

async function ctx(){
  const sb=client(); if(!sb)return null;
  const {data:{user}}=await sb.auth.getUser(); if(!user)return null;
  const {data:p,error}=await sb.from('profiles').select('user_id,role,member_id,display_name').eq('user_id',user.id).maybeSingle();
  if(error||!p?.member_id)return null;
  return {sb,p};
}

async function render(host){
  const c=await ctx();
  if(!host||!c)return;
  const {data,error}=await c.sb.from('giving_records').select('id,given_on,giving_type,amount,payment_method,reference_no,notes').eq('member_id',c.p.member_id).order('given_on',{ascending:false}).limit(250);
  if(error){host.innerHTML='<div class="suite-card suite-danger"><b>Giving ledger unavailable.</b><div class="suite-muted">'+esc(error.message)+'</div></div>';return;}
  const rows=data||[];
  const total=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  const byType={}; rows.forEach(r=>{byType[r.giving_type]=(byType[r.giving_type]||0)+Number(r.amount||0)});
  const typeRows=Object.entries(byType).map(([k,v])=>`<div class="suite-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')||'<div class="suite-empty">No giving recorded yet.</div>';
  host.innerHTML=`<div class="suite-grid two"><div class="suite-card"><div class="suite-muted">My giving on record</div><div class="suite-kpi">${money(total)}</div><div class="suite-muted">Private to your member account</div><div class="suite-list" style="margin-top:12px">${typeRows}</div></div><div class="suite-card"><h3>Giving history</h3><div class="suite-muted">Tithes, offerings, missions, building fund, and other recorded giving.</div><div class="suite-tablewrap" style="margin-top:10px"><table class="suite-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Payment</th><th>Reference</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.given_on||'')}</td><td>${esc(r.giving_type||'')}</td><td>${money(r.amount)}</td><td>${esc(r.payment_method||'')}</td><td>${esc(r.reference_no||'')}</td></tr>`).join('')||'<tr><td colspan="5" class="suite-empty">No giving records yet.</td></tr>'}</tbody></table></div></div></div><div class="suite-callout" style="margin-top:14px"><strong>Privacy</strong><span class="suite-muted">Only your own giving records are displayed here. Church-wide giving reports remain restricted to authorized administrators and pastors.</span></div>`;
}

function ensureTab(){
  const root=$('#vccfSuite'); if(!root)return;
  const tabs=$('.suite-tabs',root); if(!tabs)return;
  let b=$('[data-tab="my-giving"]',tabs);
  if(!b){b=document.createElement('button');b.type='button';b.dataset.tab='my-giving';b.textContent='₱ My Giving';tabs.appendChild(b);}
  if(b.dataset.bound==='1')return;
  b.dataset.bound='1';
  b.onclick=async()=>{
    $$('.suite-tabs button',root).forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const content=$('#suiteContent',root);if(!content)return;
    content.innerHTML='<div class="suite-card"><div class="suite-muted">Loading your giving history…</div></div>';
    await render(content);
  };
}
function boot(){if(!$('#app')?.classList.contains('active'))return;ensureTab();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
window.addEventListener('vccf-authenticated',()=>setTimeout(boot,500));
new MutationObserver(()=>{if($('#app')?.classList.contains('active'))ensureTab();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();

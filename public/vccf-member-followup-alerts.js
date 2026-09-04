(()=>{
'use strict';
if(window.__VCCF_MEMBER_FOLLOWUP_ALERTS__)return;
window.__VCCF_MEMBER_FOLLOWUP_ALERTS__=true;

const THRESHOLD_DAYS=28;
const state=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb||null;
const role=()=>String(state().profile?.role||'').toLowerCase().replace(/ /g,'_');
const allowed=()=>['admin','pastor','area_leader'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}).format(new Date(v)):'No recorded activity';
let rows=[],loading=false,lastLoaded=0,timer=0,observer=null;

function styles(){
  if(document.getElementById('vccfFollowupAlertCss'))return;
  const s=document.createElement('style');s.id='vccfFollowupAlertCss';s.textContent=`
.followup-alert-panel{margin-top:16px;padding:0;overflow:hidden;border:1px solid rgba(180,35,24,.18)!important;background:linear-gradient(135deg,rgba(215,25,32,.055),rgba(255,138,24,.035),var(--card))!important}.followup-alert-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid var(--line)}.followup-alert-head h3{margin:0 0 4px;font-size:1rem}.followup-alert-head p{margin:0;color:var(--muted);font-size:.74rem;line-height:1.45;max-width:760px}.followup-alert-count{min-width:38px;height:38px;border-radius:12px;background:#fff0f0;color:#b42318;display:grid;place-items:center;font-size:1rem;font-weight:900;border:1px solid rgba(180,35,24,.15)}.followup-alert-list{display:grid}.followup-alert-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line)}.followup-alert-row:last-child{border-bottom:0}.followup-alert-member{display:flex;gap:10px;align-items:center;min-width:0}.followup-alert-avatar{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,rgba(215,25,32,.13),rgba(255,138,24,.14));display:grid;place-items:center;color:#b42318;font-weight:900;flex:0 0 auto}.followup-alert-copy{min-width:0}.followup-alert-copy b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.followup-alert-copy span{display:block;color:var(--muted);font-size:.68rem;margin-top:2px}.followup-alert-days{text-align:right}.followup-alert-days strong{display:block;color:#b42318;font-size:.9rem}.followup-alert-days span{display:block;color:var(--muted);font-size:.64rem}.followup-alert-open{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 10px;font-weight:800;font-size:.68rem}.followup-alert-more{padding:11px 18px;color:var(--muted);font-size:.68rem;text-align:center;border-top:1px solid var(--line)}.followup-alert-empty{padding:18px;color:#167647;font-size:.76rem;font-weight:800}.followup-nav-badge{margin-left:auto;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#d71920;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:900}.m360-activity-followup{margin:12px 0 0;padding:13px 14px;border-radius:14px;border:1px solid rgba(180,35,24,.2);background:linear-gradient(135deg,rgba(215,25,32,.075),rgba(255,138,24,.055));display:flex;justify-content:space-between;gap:12px;align-items:center}.m360-activity-followup b{display:block;color:#b42318}.m360-activity-followup span{display:block;color:var(--muted);font-size:.7rem;margin-top:2px}.m360-activity-followup strong{white-space:nowrap;color:#b42318;font-size:.82rem}@media(max-width:620px){.followup-alert-head{padding:14px}.followup-alert-row{grid-template-columns:minmax(0,1fr) auto;padding:11px 14px}.followup-alert-open{grid-column:1/-1;width:100%}.followup-alert-days{align-self:start}.m360-activity-followup{align-items:flex-start;flex-direction:column}.m360-activity-followup strong{white-space:normal}}
`;document.head.appendChild(s)
}
function initials(name){return String(name||'M').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'M'}
function dashboardHost(){return document.getElementById('dashboard')}
function renderDashboard(){
  styles();const host=dashboardHost();if(!host)return;document.getElementById('memberFollowupAlerts')?.remove();if(!allowed())return;
  const panel=document.createElement('section');panel.id='memberFollowupAlerts';panel.className='card followup-alert-panel';
  if(loading&&!rows.length){panel.innerHTML='<div class="followup-alert-head"><div><h3>Follow-up Alerts</h3><p>Checking members who have not joined any recorded church activity recently.</p></div><div class="followup-alert-count">…</div></div>';}
  else if(!rows.length){panel.innerHTML='<div class="followup-alert-head"><div><h3>Follow-up Alerts</h3><p>Active members are flagged after '+THRESHOLD_DAYS+' days without recorded Sunday, Bible Study / Midweek, or event attendance.</p></div><div class="followup-alert-count">0</div></div><div class="followup-alert-empty">✓ No members in your scope currently need an inactivity follow-up.</div>'}
  else{
    const shown=rows.slice(0,8);panel.innerHTML='<div class="followup-alert-head"><div><h3>Follow-up Alerts</h3><p>Active members with no recorded church activity for '+THRESHOLD_DAYS+' days or more. Admins and Pastors see church-wide alerts; Area Leaders see only their Area.</p></div><div class="followup-alert-count">'+rows.length+'</div></div><div class="followup-alert-list">'+shown.map(r=>'<div class="followup-alert-row"><div class="followup-alert-member"><span class="followup-alert-avatar">'+esc(initials(r.display_name))+'</span><div class="followup-alert-copy"><b>'+esc(r.display_name||'Member')+'</b><span>'+esc(r.area_name||'Unassigned')+' · Last activity: '+esc(fmt(r.last_activity_at))+'</span></div></div><div class="followup-alert-days"><strong>'+Number(r.days_inactive||0)+' days</strong><span>without activity</span></div><button class="followup-alert-open" type="button" data-followup-member="'+esc(r.member_id)+'">View member</button></div>').join('')+'</div>'+(rows.length>shown.length?'<div class="followup-alert-more">+'+(rows.length-shown.length)+' more member'+(rows.length-shown.length===1?'':'s')+' need follow-up</div>':'')
  }
  const stats=host.querySelector('.stats');if(stats)stats.insertAdjacentElement('afterend',panel);else host.prepend(panel);
  panel.querySelectorAll('[data-followup-member]').forEach(b=>b.onclick=()=>openMember(b.dataset.followupMember));
}
function navBadge(){
  const b=document.querySelector('[data-route="pastoral"]');if(!b)return;b.querySelector('.followup-nav-badge')?.remove();if(!allowed()||!rows.length)return;const badge=document.createElement('span');badge.className='followup-nav-badge';badge.textContent=rows.length>99?'99+':String(rows.length);badge.title=rows.length+' member follow-up alert'+(rows.length===1?'':'s');b.appendChild(badge)
}
function currentMemberId(){const key=String(document.querySelector('#members .m360-qr-code')?.textContent||'').trim();if(!key)return '';const m=(state().members||[]).find(x=>String(x.id)===key||String(x.member_code||'')===key);return m?.id||''}
function profileAlert(){
  document.querySelector('#members .m360-activity-followup')?.remove();if(!allowed())return;const id=currentMemberId(),alert=rows.find(r=>String(r.member_id)===String(id));if(!alert)return;const hero=document.querySelector('#members .m360-hero');if(!hero)return;const el=document.createElement('div');el.className='m360-activity-followup';el.innerHTML='<div><b>Follow-up recommended</b><span>No recorded church activity since '+esc(fmt(alert.last_activity_at))+'. This leadership alert is based on Sunday, Bible Study / Midweek, and event attendance.</span></div><strong>'+Number(alert.days_inactive||0)+' days inactive</strong>';hero.insertAdjacentElement('afterend',el)
}
function openMember(id){
  document.querySelector('[data-route="members"]')?.click();let tries=0;const find=()=>{const row=document.querySelector('#members [data-member-id="'+CSS.escape(String(id))+'"]');if(row){row.click();return}if(++tries<12)setTimeout(find,100)};setTimeout(find,100)
}
async function refresh(force=false){
  if(!allowed()){rows=[];renderDashboard();navBadge();profileAlert();return}
  if(loading)return;if(!force&&Date.now()-lastLoaded<5*60*1000){renderDashboard();navBadge();profileAlert();return}
  const client=db();if(!client)return;loading=true;renderDashboard();
  try{const result=await client.rpc('get_member_followup_alerts',{p_days:THRESHOLD_DAYS});if(result.error)throw result.error;rows=result.data||[];lastLoaded=Date.now();window.VCCFFollowupAlerts={thresholdDays:THRESHOLD_DAYS,rows,refresh:()=>refresh(true)}}catch(error){console.warn('Follow-up alerts',error);rows=[]}finally{loading=false;renderDashboard();navBadge();profileAlert()}
}
function queue(){clearTimeout(timer);timer=setTimeout(()=>{renderDashboard();navBadge();profileAlert();void refresh(false)},100)}
function watch(){if(observer)return;observer=new MutationObserver(()=>queue());observer.observe(document.documentElement,{childList:true,subtree:true})}
window.addEventListener('vccf-app-ready',()=>refresh(true));window.addEventListener('focus',()=>refresh(false));window.addEventListener('vccf-service-attendance-updated',()=>refresh(true));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watch();queue()},{once:true});else{watch();queue()}
})();

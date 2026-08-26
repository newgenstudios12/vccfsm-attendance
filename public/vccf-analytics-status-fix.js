(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V3__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V3__=true;

const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const normRole=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function manilaDate(v){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}
function sundayList(count=4){
  const today=manilaDate(new Date());
  const d=new Date(`${today}T12:00:00+08:00`);
  d.setDate(d.getDate()-d.getDay());
  const out=[];
  for(let i=0;i<count;i+=1){out.push(manilaDate(d));d.setDate(d.getDate()-7)}
  return out;
}

async function getEffectiveMembers(){
  const c=getClient();if(!c)return null;
  const {data:{user},error:ue}=await c.auth.getUser();if(ue||!user)return null;
  const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();if(pe||!profile)return null;
  const role=normRole(profile.role);if(!['admin','area leader'].includes(role))return null;

  let q=c.from('members').select('id,area_id,created_at,status');
  if(role==='area leader')q=q.eq('area_id',profile.area_id);
  const {data:members,error:me}=await q.order('display_name');
  if(me)return null;
  const {data:attendance,error:ae}=await c.from('attendance').select('member_id,checked_in_at');
  if(ae)return null;

  const sundays=sundayList(4);
  const oldest=sundays[3];
  const seen=new Map();
  (attendance||[]).forEach(a=>{
    const day=manilaDate(a.checked_in_at);
    if(!sundays.includes(day))return;
    const id=String(a.member_id);
    if(!seen.has(id))seen.set(id,new Set());
    seen.get(id).add(day);
  });

  return (members||[]).map(m=>{
    const joined=m.created_at?manilaDate(m.created_at):null;
    const eligible=!joined||joined<=oldest;
    const fourConsecutiveMisses=eligible&&sundays.every(day=>!(seen.get(String(m.id))?.has(day)));
    return {...m,effectiveStatus:fourConsecutiveMisses?'inactive':'active'};
  });
}

function currentAreaFilter(){
  const select=[...document.querySelectorAll('select')].find(s=>
    /statistics|area|total/i.test((s.getAttribute('aria-label')||'')+' '+s.className+' '+[...s.options].map(o=>o.textContent).join(' ')) &&
    [...s.options].some(o=>/all areas|total|per area/i.test(o.textContent))
  );
  return select?.value||'all';
}

async function refreshStats(){
  try{
    const members=await getEffectiveMembers();
    if(!members)return;
    const selected=currentAreaFilter();
    let scoped=members;
    if(selected&&!/^(all|total)$/i.test(String(selected))){
      scoped=members.filter(m=>String(m.area_id)===String(selected)||String(m.area_id||'').toLowerCase()===String(selected).toLowerCase());
    }
    const total=scoped.length;
    const inactive=scoped.filter(m=>m.effectiveStatus==='inactive').length;
    const active=total-inactive;

    document.querySelectorAll('.stats .stat').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');if(!value)return;
      if(label.includes('inactive'))value.textContent=inactive;
      else if(label.includes('active'))value.textContent=active;
      else if(label.includes('total')&&label.includes('member'))value.textContent=total;
    });

    document.querySelectorAll('.suite-kpi').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');if(!value)return;
      if(label==='inactive')value.textContent=inactive;
      else if(label==='active')value.textContent=active;
      else if(label.includes('total')&&label.includes('member'))value.textContent=total;
    });
  }catch(e){console.warn('VCCF effective member statistics:',e);}
}

function repairAnalyticsNavigation(){
  const button=document.querySelector('.nav button[data-view="analytics"]');
  if(!button)return;
  const hasInjectedContent=button.querySelector('.suite-shell,.suite-card,.suite-kpi,.vccf-analytics-chart,.vccf-area-grid,h1,h2,h3,h4,table,select');
  if(hasInjectedContent||button.childElementCount!==1||button.querySelector('span')?.nextSibling){
    button.innerHTML='<span aria-hidden="true">◔</span> Analytics';
    button.dataset.suiteV2='analytics';
    button.dataset.view='analytics';
  }
}

function installObservers(){
  const analyticsHost=document.getElementById('suite2Analytics');
  if(analyticsHost&&!analyticsHost.dataset.vccfStatsObserved){
    analyticsHost.dataset.vccfStatsObserved='1';
    const mo=new MutationObserver(()=>{clearTimeout(window.__VCCF_ANALYTICS_STATS_TIMER__);window.__VCCF_ANALYTICS_STATS_TIMER__=setTimeout(refreshStats,80)});
    mo.observe(analyticsHost,{childList:true,subtree:true,characterData:true});
  }
  const nav=document.querySelector('.nav');
  if(nav&&!nav.dataset.vccfAnalyticsNavObserved){
    nav.dataset.vccfAnalyticsNavObserved='1';
    const mo=new MutationObserver(repairAnalyticsNavigation);
    mo.observe(nav,{childList:true,subtree:true,characterData:true});
  }
  repairAnalyticsNavigation();
}

function schedule(delay=500){
  clearTimeout(window.__VCCF_ANALYTICS_STATUS_TIMER__);
  window.__VCCF_ANALYTICS_STATUS_TIMER__=setTimeout(()=>{installObservers();refreshStats()},delay);
}

function boot(){
  schedule(700);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('button[data-view="dashboard"],button[data-view="analytics"],button[data-view="members"]'))schedule(500);
    if(e.target.closest?.('select'))schedule(500);
  });
  document.addEventListener('change',e=>{if(e.target.closest?.('select,.vccf-inline-status'))schedule(700)});
  window.addEventListener('vccf-app-ready',()=>schedule(900));
  setInterval(()=>{
    const active=document.querySelector('#dashboard.view.active,#suite2-analytics.view.active');
    if(active)schedule(100);
  },3000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();

(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V4__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V4__=true;

const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const roleName=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');

function authoritativeStatus(m){
  if(String(m?.status||'').trim().toLowerCase()==='inactive')return 'inactive';
  if(m?.is_active===false)return 'inactive';
  return 'active';
}

async function refreshStats(){
  try{
    const app=document.getElementById('app');
    if(!app?.classList.contains('active'))return;
    const c=getClient();if(!c)return;
    const {data:{user},error:ue}=await c.auth.getUser();if(ue||!user)return;
    const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();if(pe||!profile)return;
    const role=roleName(profile.role);if(!['admin','area leader'].includes(role))return;

    let q=c.from('members').select('id,area_id,status,is_active');
    if(role==='area leader')q=q.eq('area_id',profile.area_id);
    const {data:members,error:me}=await q.order('display_name');if(me)return;

    let scoped=Array.isArray(members)?members:[];
    const filter=document.getElementById('memberStatsArea')||document.querySelector('#memberStatsFilter select');
    if(role==='admin'&&filter?.value&&!/^(all|total)$/i.test(String(filter.value))){
      scoped=scoped.filter(m=>String(m.area_id)===String(filter.value));
    }

    const total=scoped.length;
    const inactive=scoped.filter(m=>authoritativeStatus(m)==='inactive').length;
    const active=total-inactive;

    document.querySelectorAll('.suite-kpi').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');if(!value)return;
      if(label==='active')value.textContent=active;
      else if(label==='inactive')value.textContent=inactive;
      else if(label.includes('total')&&label.includes('member'))value.textContent=total;
    });

    const cards=document.querySelectorAll('#memberStatsCards .stat');
    cards.forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');if(!value)return;
      if(label.includes('inactive'))value.textContent=inactive;
      else if(label.includes('active'))value.textContent=active;
      else if(label.includes('total')&&label.includes('member'))value.textContent=total;
    });
  }catch(e){console.warn('VCCF analytics statistics:',e)}
}

function repairAnalyticsNavigation(){
  const nav=document.querySelector('.nav');if(!nav)return;
  const buttons=[...nav.querySelectorAll('button[data-view="analytics"]')];
  buttons.forEach(button=>{
    const polluted=button.querySelector('.suite-shell,.suite-card,.suite-kpi,.vccf-analytics-chart,.vccf-area-grid,#vccfSundayAnalytics,.panel')||button.textContent.includes('Sunday Attendance Overview');
    if(polluted||button.childElementCount>1){
      button.innerHTML='<span aria-hidden="true">◔</span> Analytics';
      button.dataset.suiteV2='analytics';
      button.dataset.view='analytics';
    }
  });
  const stray=[...nav.querySelectorAll('*')].filter(el=>/Sunday Attendance Overview/i.test(el.textContent||'')&&el!==nav);
  stray.forEach(el=>{const container=el.closest('button[data-view="analytics"]');if(container){container.innerHTML='<span aria-hidden="true">◔</span> Analytics';container.dataset.suiteV2='analytics';container.dataset.view='analytics';}});
}

function installObservers(){
  repairAnalyticsNavigation();
  const nav=document.querySelector('.nav');
  if(nav&&!nav.dataset.vccfAnalyticsNavObserved){
    nav.dataset.vccfAnalyticsNavObserved='1';
    new MutationObserver(()=>repairAnalyticsNavigation()).observe(nav,{childList:true,subtree:true,characterData:true});
  }
  const analyticsHost=document.getElementById('suite2Analytics');
  if(analyticsHost&&!analyticsHost.dataset.vccfStatsObserved){
    analyticsHost.dataset.vccfStatsObserved='1';
    new MutationObserver(()=>{clearTimeout(window.__VCCF_ANALYTICS_STATS_TIMER__);window.__VCCF_ANALYTICS_STATS_TIMER__=setTimeout(refreshStats,80)}).observe(analyticsHost,{childList:true,subtree:true,characterData:true});
  }
}

function schedule(delay=500){
  clearTimeout(window.__VCCF_ANALYTICS_STATUS_TIMER__);
  window.__VCCF_ANALYTICS_STATUS_TIMER__=setTimeout(()=>{installObservers();refreshStats()},delay);
}

function boot(){
  if(!document.getElementById('app')?.classList.contains('active')){
    window.addEventListener('vccf-app-ready',()=>schedule(400),{once:false});
  }else schedule(500);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('button[data-view="analytics"],button[data-suite-v2="analytics"],button[data-view="dashboard"],button[data-view="members"]))schedule(450);
    if(e.target.closest?.('#memberStatsArea,#memberStatsFilter select'))schedule(450);
  });
  document.addEventListener('change',e=>{if(e.target.closest?.('#memberStatsArea,#memberStatsFilter select,.vccf-inline-status'))schedule(600)});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();

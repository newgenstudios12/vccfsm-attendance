(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V4__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V4__=true;

const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const normRole=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
const manilaDate=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const sundayList=(count=4)=>{const today=manilaDate(new Date());const d=new Date(`${today}T12:00:00+08:00`);d.setDate(d.getDate()-d.getDay());const out=[];for(let i=0;i<count;i+=1){out.push(manilaDate(d));d.setDate(d.getDate()-7)}return out};

function appReady(){return document.getElementById('app')?.classList.contains('active')&& !document.getElementById('login')?.getBoundingClientRect?.().width;}
function loginVisible(){const el=document.getElementById('login');return !!el && getComputedStyle(el).display!=='none';}

async function getEffectiveMembers(){
  if(!appReady()||loginVisible())return null;
  const c=getClient();if(!c)return null;
  const {data:{user},error:ue}=await c.auth.getUser();if(ue||!user)return null;
  const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();if(pe||!profile)return null;
  const role=normRole(profile.role);if(!['admin','area leader'].includes(role))return null;
  let q=c.from('members').select('id,area_id,created_at');
  if(role==='area leader')q=q.eq('area_id',profile.area_id);
  const {data:members,error:me}=await q.order('display_name');if(me)return null;
  const {data:attendance,error:ae}=await c.from('attendance').select('member_id,checked_in_at');if(ae)return null;
  const sundays=sundayList(4),oldest=sundays[3],seen=new Map();
  (attendance||[]).forEach(a=>{const day=manilaDate(a.checked_in_at);if(!sundays.includes(day))return;const id=String(a.member_id);if(!seen.has(id))seen.set(id,new Set());seen.get(id).add(day)});
  return (members||[]).map(m=>{const joined=m.created_at?manilaDate(m.created_at):null;const eligible=!joined||joined<=oldest;const inactive=eligible&&sundays.every(day=>!(seen.get(String(m.id))?.has(day)));return {...m,effectiveStatus:inactive?'inactive':'active'}});
}

function currentAreaFilter(){
  const select=[...document.querySelectorAll('.main select')].find(s=>/statistics|area|total/i.test((s.getAttribute('aria-label')||'')+' '+s.className+' '+[...s.options].map(o=>o.textContent).join(' '))&&[...s.options].some(o=>/all areas|total|per area/i.test(o.textContent)));
  return select?.value||'all';
}

async function refreshStats(){
  if(!appReady()||loginVisible())return;
  try{
    const members=await getEffectiveMembers();if(!members)return;
    const selected=currentAreaFilter();let scoped=members;
    if(selected&&!/^(all|total)$/i.test(String(selected)))scoped=members.filter(m=>String(m.area_id)===String(selected)||String(m.area_id||'').toLowerCase()===String(selected).toLowerCase());
    const total=scoped.length,inactive=scoped.filter(m=>m.effectiveStatus==='inactive').length,active=total-inactive;
    document.querySelectorAll('.stats .stat,.suite-kpi').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();const value=card.querySelector('strong');if(!value)return;
      if(label.includes('inactive'))value.textContent=inactive;
      else if(label.includes('active'))value.textContent=active;
      else if(label.includes('total')&&label.includes('member'))value.textContent=total;
    });
  }catch(e){console.warn('VCCF effective member statistics:',e);}
}

function repairAnalyticsNavigation(){
  if(loginVisible())return;
  const button=document.querySelector('.nav button[data-view="analytics"]');if(!button)return;
  const hasInjectedContent=button.querySelector('.suite-shell,.suite-card,.suite-kpi,.vccf-analytics-chart,.vccf-area-grid,h1,h2,h3,h4,table,select');
  if(hasInjectedContent||button.childElementCount!==1||button.querySelector('span')?.nextSibling){button.innerHTML='<span aria-hidden="true">◔</span> Analytics';button.dataset.suiteV2='analytics';button.dataset.view='analytics';}
}

function installObservers(){
  if(loginVisible()||!appReady())return;
  const analyticsHost=document.getElementById('suite2Analytics');
  if(analyticsHost&&!analyticsHost.dataset.vccfStatsObserved){
    analyticsHost.dataset.vccfStatsObserved='1';
    const mo=new MutationObserver(()=>{clearTimeout(window.__VCCF_ANALYTICS_STATS_TIMER__);window.__VCCF_ANALYTICS_STATS_TIMER__=setTimeout(refreshStats,120)});
    mo.observe(analyticsHost,{childList:true,subtree:true,characterData:true});
  }
  const nav=document.querySelector('.nav');
  if(nav&&!nav.dataset.vccfAnalyticsNavObserved){
    nav.dataset.vccfAnalyticsNavObserved='1';
    const mo=new MutationObserver(repairAnalyticsNavigation);mo.observe(nav,{childList:true,subtree:true,characterData:true});
  }
  repairAnalyticsNavigation();
}

function schedule(delay=500){
  if(loginVisible()||!appReady())return;
  clearTimeout(window.__VCCF_ANALYTICS_STATUS_TIMER__);window.__VCCF_ANALYTICS_STATUS_TIMER__=setTimeout(()=>{if(loginVisible()||!appReady())return;installObservers();refreshStats()},delay);
}

function boot(){
  if(loginVisible()||!appReady())return;
  installObservers();schedule(700);
  const nav=document.querySelector('.nav');
  nav?.addEventListener('click',e=>{if(e.target.closest?.('button[data-view="dashboard"],button[data-view="analytics"],button[data-suite-v2="analytics"],button[data-view="members"]))schedule(400)},{passive:true});
  nav?.addEventListener('change',e=>{if(e.target.closest?.('select,.vccf-inline-status'))schedule(600)},{passive:true});
  window.addEventListener('vccf-app-ready',()=>schedule(700),{once:false});
}

window.addEventListener('vccf-app-ready',()=>setTimeout(boot,120));
if(document.readyState==='complete')setTimeout(boot,250);
})();

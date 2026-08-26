(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V3__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V3__=true;

const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const normRole=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
const manilaFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'});
const manilaDate=v=>manilaFmt.format(new Date(v));

function lastFourSundays(){
  const today=manilaDate(new Date());
  const d=new Date(`${today}T12:00:00+08:00`);
  d.setDate(d.getDate()-d.getDay());
  const out=[];
  for(let i=0;i<4;i++){
    out.push(manilaDate(d));
    d.setDate(d.getDate()-7);
  }
  return out;
}

async function getEffectiveMembers(){
  const c=getClient();
  if(!c)return null;
  const {data:{user},error:ue}=await c.auth.getUser();
  if(ue||!user)return null;
  const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();
  if(pe||!profile)return null;
  const role=normRole(profile.role);
  if(!['admin','area leader'].includes(role))return null;

  let q=c.from('members').select('id,area_id,status,created_at');
  if(role==='area leader')q=q.eq('area_id',profile.area_id);
  const {data:members,error:me}=await q.order('display_name');
  if(me){console.warn('VCCF member status query:',me);return null;}

  const {data:attendance,error:ae}=await c.from('attendance').select('member_id,checked_in_at');
  if(ae){console.warn('VCCF attendance status query:',ae);return null;}

  const sundays=lastFourSundays();
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
    const eligible=!joined||joined<=sundays[3];
    const autoInactive=eligible&&sundays.every(day=>!(seen.get(String(m.id))?.has(day)));
    const effectiveStatus=autoInactive?'inactive':(String(m.status||'active').trim().toLowerCase()==='inactive'?'inactive':'active');
    return {...m,effectiveStatus};
  });
}

function areaSelection(){
  return [...document.querySelectorAll('select')].find(s=>
    /statistics|area|total/i.test((s.getAttribute('aria-label')||'')+' '+s.className+' '+[...s.options].map(o=>o.textContent).join(' ')) &&
    [...s.options].some(o=>/all areas|total|per area/i.test(o.textContent))
  );
}

function applyCounts(scoped){
  document.querySelectorAll('.stats .stat').forEach(card=>{
    const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
    const value=card.querySelector('strong');
    if(!value)return;
    if(label.includes('inactive'))value.textContent=scoped.inactive;
    else if(label.includes('active'))value.textContent=scoped.active;
    else if(label.includes('total')&&label.includes('member'))value.textContent=scoped.total;
  });

  document.querySelectorAll('.suite-kpi').forEach(card=>{
    const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
    const value=card.querySelector('strong');
    if(!value)return;
    if(label==='active')value.textContent=scoped.active;
    else if(label==='inactive')value.textContent=scoped.inactive;
    else if(label.includes('total')&&label.includes('member'))value.textContent=scoped.total;
  });
}

async function refreshAuthoritativeMemberStatusStats(){
  try{
    const members=await getEffectiveMembers();
    if(!members)return;
    let filtered=members;
    const ctx=await (async()=>{
      const c=getClient(); if(!c)return null;
      const {data:{user}}=await c.auth.getUser(); if(!user)return null;
      return (await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle()).data;
    })();
    const role=normRole(ctx?.role);
    const select=areaSelection();
    if(role!=='area leader'&&select?.value&&!/total|all/i.test(select.value)){
      const areaValue=String(select.value);
      filtered=members.filter(m=>String(m.area_id)===areaValue||String(m.area_id||'').toLowerCase()===areaValue.toLowerCase());
    }
    const active=filtered.filter(m=>m.effectiveStatus==='active').length;
    const inactive=filtered.filter(m=>m.effectiveStatus==='inactive').length;
    applyCounts({total:filtered.length,active,inactive});
  }catch(e){console.warn('VCCF effective member statistics refresh:',e);}
}

function keepSuiteViewsInMain(){
  const main=document.querySelector('.main');
  if(!main)return;
  ['analytics','events','notifications','profile'].forEach(name=>{
    const el=document.getElementById(`suite2-${name}`);
    if(el&&el.parentElement!==main)main.appendChild(el);
  });
}

function stabilizeNav(){
  keepSuiteViewsInMain();
  document.querySelectorAll('.sidebar .nav button[data-suite-v2]').forEach(button=>{
    button.style.minHeight='46px';
    button.style.height='46px';
    button.style.maxHeight='46px';
    button.style.flex='0 0 46px';
    button.style.overflow='hidden';
    button.style.whiteSpace='nowrap';
  });
}

function schedule(delay=450){
  clearTimeout(window.__VCCF_EFFECTIVE_STATS_TIMER__);
  window.__VCCF_EFFECTIVE_STATS_TIMER__=setTimeout(async()=>{
    stabilizeNav();
    await refreshAuthoritativeMemberStatusStats();
  },delay);
}

function boot(){
  schedule(900);
  const observer=new MutationObserver(()=>{
    stabilizeNav();
    if(document.getElementById('suite2Analytics')||document.querySelector('#suite2-analytics .suite-kpi'))schedule(150);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('button[data-view="dashboard"],button[data-view="analytics"],button[data-suite-v2="analytics"]'))schedule(700);
    if(e.target.closest?.('button[data-view="members"]'))schedule(1000);
  });
  document.addEventListener('change',e=>{
    if(e.target.closest?.('.vccf-inline-status,select'))schedule(800);
  });
  window.addEventListener('vccf-app-ready',()=>schedule(1200));
  window.addEventListener('vccf-profile-linked',()=>schedule(700));
  setInterval(()=>{
    if(document.querySelector('#dashboard.view.active,#suite2-analytics.view.active'))schedule(100);
  },5000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();

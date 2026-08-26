(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V2__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V2__=true;

const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const normRole=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');

async function refreshAuthoritativeMemberStatusStats(){
  try{
    const c=getClient();
    if(!c)return;
    const {data:{user},error:ue}=await c.auth.getUser();
    if(ue||!user)return;
    const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();
    if(pe||!profile)return;
    const role=normRole(profile.role);
    if(!['admin','area leader'].includes(role))return;

    let q=c.from('members').select('id,area_id,status');
    if(role==='area leader')q=q.eq('area_id',profile.area_id);
    const {data:members,error:me}=await q;
    if(me){console.warn('VCCF authoritative member statistics:',me);return;}

    const rows=Array.isArray(members)?members:[];
    const activeCount=rows.filter(m=>String(m.status||'active').trim().toLowerCase()==='active').length;
    const inactiveCount=rows.filter(m=>String(m.status||'active').trim().toLowerCase()==='inactive').length;
    const totalCount=rows.length;

    const areaSelect=[...document.querySelectorAll('select')].find(s=>
      /statistics|area|total/i.test((s.getAttribute('aria-label')||'')+' '+s.className+' '+[...s.options].map(o=>o.textContent).join(' ')) &&
      [...s.options].some(o=>/all areas|total|per area/i.test(o.textContent))
    );
    let scoped={total:totalCount,active:activeCount,inactive:inactiveCount};
    if(role==='admin' && areaSelect?.value && !/total|all/i.test(areaSelect.value)){
      const areaValue=String(areaSelect.value);
      const areaRows=rows.filter(m=>String(m.area_id)===areaValue || String(m.area_id||'').toLowerCase()===areaValue.toLowerCase());
      scoped={
        total:areaRows.length,
        active:areaRows.filter(m=>String(m.status||'active').trim().toLowerCase()==='active').length,
        inactive:areaRows.filter(m=>String(m.status||'active').trim().toLowerCase()==='inactive').length
      };
    }

    // Main dashboard/member-stat cards.
    document.querySelectorAll('.stats .stat').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');
      if(!value)return;
      if(label.includes('inactive'))value.textContent=scoped.inactive;
      else if(label.includes('active'))value.textContent=scoped.active;
      else if(label.includes('total')&&label.includes('member'))value.textContent=scoped.total;
    });

    // Analytics/Sunday Attendance Overview KPI cards.
    document.querySelectorAll('.suite-kpi').forEach(card=>{
      const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
      const value=card.querySelector('strong');
      if(!value)return;
      if(label==='active')value.textContent=scoped.active;
      else if(label==='inactive')value.textContent=scoped.inactive;
      else if(label.includes('total')&&label.includes('member'))value.textContent=scoped.total;
    });
  }catch(e){console.warn('VCCF authoritative member statistics refresh:',e);}
}

window.vccfRefreshAuthoritativeMemberStatusStats=refreshAuthoritativeMemberStatusStats;

function schedule(delay=450){
  clearTimeout(window.__VCCF_AUTHORITATIVE_STATS_TIMER__);
  window.__VCCF_AUTHORITATIVE_STATS_TIMER__=setTimeout(refreshAuthoritativeMemberStatusStats,delay);
}

function boot(){
  schedule(900);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('button[data-view="dashboard"],button[data-view="analytics"]'))schedule(700);
    if(e.target.closest?.('button[data-view="members"]'))schedule(1200);
    if(e.target.closest?.('select'))schedule(700);
  });
  document.addEventListener('change',e=>{
    if(e.target.closest?.('.vccf-inline-status,.search,select'))schedule(1000);
  });
  window.addEventListener('vccf-app-ready',()=>schedule(1200));
  setInterval(()=>{
    const dashboard=document.querySelector('#dashboard.view.active');
    const analytics=document.querySelector('#suite2-analytics.view.active');
    if(dashboard||analytics)schedule(100);
  },5000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();

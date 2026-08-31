(()=>{
'use strict';
if(window.__VCCF_ANALYTICS_STATUS_FIX_V4__)return;
window.__VCCF_ANALYTICS_STATUS_FIX_V4__=true;

// VCCF LOGIN COMPATIBILITY: the legacy inline login handler treats every
// identifier as an email. Capture the submit event before that handler so
// usernames are normalized to the same username@vccf.local convention used
// by the account-creation flow. Real email addresses continue to work.
const installUsernameLogin=()=>{
  if(document.documentElement.dataset.vccfUsernameLoginInstalled==='1')return;
  document.documentElement.dataset.vccfUsernameLoginInstalled='1';
  document.addEventListener('submit',async e=>{
    const form=e.target;
    if(!form||form.id!=='loginForm')return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const identifier=(document.getElementById('loginUser')?.value||'').trim();
    const password=document.getElementById('loginPass')?.value||'';
    if(!identifier){alert('Please enter your email or username.');return}
    if(!password){alert('Please enter your password.');return}
    const username=identifier.toLowerCase();
    const sanitized=username.replace(/[^a-z0-9._-]/g,'');
    const email=username.includes('@')?username:`${sanitized}@vccf.local`;
    const button=form.querySelector('button[type="submit"],button');
    const originalText=button?.textContent||'Sign in';
    if(button){button.disabled=true;button.textContent='Signing in…'}
    let box=document.getElementById('vccfLoginError');
    if(!box){
      box=document.createElement('div');
      box.id='vccfLoginError';
      box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap';
      form.appendChild(box);
    }
    box.textContent='';
    try{
      const c=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      if(!c)throw new Error('Authentication service is unavailable. Please refresh and try again.');
      const {data,error}=await c.auth.signInWithPassword({email,password});
      if(error)throw new Error(`Sign-in failed: ${error.message}`);
      if(!data?.user)throw new Error('Sign-in returned no user.');
      const {data:profile,error:profileError}=await c.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',data.user.id).maybeSingle();
      if(profileError)throw new Error(`Profile lookup failed: ${profileError.message}`);
      if(!profile)throw new Error('Authentication succeeded, but this account has no VCCF profile. Please contact an administrator.');
      box.style.background='#ecfdf3';box.style.color='#027a48';box.textContent='Sign-in successful. Loading VCCF…';
      window.dispatchEvent(new CustomEvent('vccf-authenticated'));
      await new Promise(r=>setTimeout(r,150));
      window.location.reload();
    }catch(err){
      console.error('VCCF username login:',err);
      box.style.background='#fff1f1';box.style.color='#b42318';box.textContent=err?.message||String(err);
    }finally{
      if(button){button.disabled=false;button.textContent=originalText}
    }
  },true);
};
installUsernameLogin();

const start=()=>{
const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const roleName=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
function authoritativeStatus(m){if(String(m?.status||'').trim().toLowerCase()==='inactive')return 'inactive';if(m?.is_active===false)return 'inactive';return 'active'}
async function refreshStats(){try{const app=document.getElementById('app');if(!app?.classList.contains('active'))return;const c=getClient();if(!c)return;const {data:{user},error:ue}=await c.auth.getUser();if(ue||!user)return;const {data:profile,error:pe}=await c.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();if(pe||!profile)return;const role=roleName(profile.role);if(!['admin','area leader'].includes(role))return;let q=c.from('members').select('id,area_id,status,is_active');if(role==='area leader')q=q.eq('area_id',profile.area_id);const {data:members,error:me}=await q.order('display_name');if(me)return;let scoped=Array.isArray(members)?members:[];const filter=document.getElementById('memberStatsArea')||document.querySelector('#memberStatsFilter select');if(role==='admin'&&filter?.value&&!/^(all|total)$/i.test(String(filter.value)))scoped=scoped.filter(m=>String(m.area_id)===String(filter.value));const total=scoped.length;const inactive=scoped.filter(m=>authoritativeStatus(m)==='inactive').length;const active=total-inactive;document.querySelectorAll('.suite-kpi').forEach(card=>{const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();const value=card.querySelector('strong');if(!value)return;if(label==='active')value.textContent=active;else if(label==='inactive')value.textContent=inactive;else if(label.includes('total')&&label.includes('member'))value.textContent=total});document.querySelectorAll('#memberStatsCards .stat').forEach(card=>{const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();const value=card.querySelector('strong');if(!value)return;if(label.includes('inactive'))value.textContent=inactive;else if(label.includes('active'))value.textContent=active;else if(label.includes('total')&&label.includes('member'))value.textContent=total})}catch(e){console.warn('VCCF analytics statistics:',e)}}
function repairAnalyticsNavigation(){const nav=document.querySelector('.nav');if(!nav)return;const buttons=[...nav.querySelectorAll('button[data-view="analytics"]')];buttons.forEach(button=>{const polluted=button.querySelector('.suite-shell,.suite-card,.suite-kpi,.vccf-analytics-chart,.vccf-area-grid,#vccfSundayAnalytics,.panel')||button.textContent.includes('Sunday Attendance Overview');if(polluted||button.childElementCount>1){button.innerHTML='<span aria-hidden="true">◔</span> Analytics';button.dataset.suiteV2='analytics';button.dataset.view='analytics'}});const stray=[...nav.querySelectorAll('*')].filter(el=>/Sunday Attendance Overview/i.test(el.textContent||'')&&el!==nav);stray.forEach(el=>{const container=el.closest('button[data-view="analytics"]');if(container){container.innerHTML='<span aria-hidden="true">◔</span> Analytics';container.dataset.suiteV2='analytics';container.dataset.view='analytics'}})}
function installObservers(){repairAnalyticsNavigation();const nav=document.querySelector('.nav');if(nav&&!nav.dataset.vccfAnalyticsNavObserved){nav.dataset.vccfAnalyticsNavObserved='1';new MutationObserver(()=>repairAnalyticsNavigation()).observe(nav,{childList:true,subtree:true,characterData:true})}const analyticsHost=document.getElementById('suite2Analytics');if(analyticsHost&&!analyticsHost.dataset.vccfStatsObserved){analyticsHost.dataset.vccfStatsObserved='1';new MutationObserver(()=>{clearTimeout(window.__VCCF_ANALYTICS_STATS_TIMER__);window.__VCCF_ANALYTICS_STATS_TIMER__=setTimeout(refreshStats,80)}).observe(analyticsHost,{childList:true,subtree:true,characterData:true})}}
function schedule(delay=500){clearTimeout(window.__VCCF_ANALYTICS_STATUS_TIMER__);window.__VCCF_ANALYTICS_STATUS_TIMER__=setTimeout(()=>{installObservers();refreshStats()},delay)}
function boot(){if(!document.getElementById('app')?.classList.contains('active'))return;document.addEventListener('click',e=>{if(e.target.closest?.('button[data-view="analytics"],button[data-suite-v2="analytics"],button[data-view="dashboard"],button[data-view="members"]))schedule(450);if(e.target.closest?.('#memberStatsArea,#memberStatsFilter select'))schedule(450)});document.addEventListener('change',e=>{if(e.target.closest?.('#memberStatsArea,#memberStatsFilter select,.vccf-inline-status'))schedule(600)});schedule(500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('vccf-authenticated',boot,{once:true});
})();

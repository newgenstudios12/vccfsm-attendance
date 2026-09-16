(()=>{
'use strict';
if(window.__VCCF_LEADER_USER_PROFILE__)return;window.__VCCF_LEADER_USER_PROFILE__=true;
const V=()=>window.VCCF,S=()=>V()?.getState?.()||{},sb=()=>V()?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let profiles=[],memberId=null,loading=false,accountObserver=null,observedAccount=null;
function styles(){if(document.getElementById('vccfLeaderUserProfileStyles'))return;const s=document.createElement('style');s.id='vccfLeaderUserProfileStyles';s.textContent=`
.vccf-self-leader-about{margin-top:16px;padding-top:15px;border-top:1px solid var(--line)}.vccf-self-leader-about-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px}.vccf-self-leader-about-head strong{font-size:.88rem}.vccf-self-leader-badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(215,25,32,.08);color:var(--brand);font-size:.64rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.vccf-self-leader-about p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.62}.vccf-self-leader-note{margin-top:8px;color:var(--muted);font-size:.7rem;font-weight:700}
`;document.head.appendChild(s)}
async function load(){const mid=S().profile?.member_id;if(!mid||!sb()||loading)return;memberId=mid;loading=true;try{const r=await sb().from('site_people').select('id,kind,name,description,sort_order').eq('member_id',mid).order('sort_order');if(r.error)throw r.error;profiles=r.data||[];render()}catch(e){console.warn('Leader user profile:',e)}finally{loading=false}}
function render(){const box=document.getElementById('accountPanel');if(!box||!profiles.length)return;box.querySelectorAll('.vccf-self-leader-about').forEach(x=>x.remove());profiles.forEach(p=>{const el=document.createElement('section');el.className='vccf-self-leader-about';el.innerHTML='<div class="vccf-self-leader-about-head"><strong>About the Leader</strong><span class="vccf-self-leader-badge">'+esc(p.kind||'Leader')+'</span></div><p>'+esc(p.description||'Leader profile details will be added soon.')+'</p><div class="vccf-self-leader-note">This public leadership profile is managed by an administrator.</div>';box.appendChild(el)})}
function bindAccountObserver(){const box=document.getElementById('accountPanel');if(box===observedAccount)return;accountObserver?.disconnect();observedAccount=box||null;if(box){accountObserver=new MutationObserver(()=>{if(profiles.length&&!box.querySelector('.vccf-self-leader-about'))render()});accountObserver.observe(box,{childList:true,subtree:false})}}
function refresh(){styles();bindAccountObserver();const mid=S().profile?.member_id;if(mid&&mid!==memberId)void load();else if(profiles.length)render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.addEventListener('vccf-app-ready',()=>setTimeout(refresh,150));
window.addEventListener('vccf-profile-linked',refresh);
window.addEventListener('vccf-signed-out',()=>{profiles=[];memberId=null;accountObserver?.disconnect();accountObserver=null;observedAccount=null});
})();

(()=>{
'use strict';
if(window.__VCCF_SUNDAY_STREAK_LOADER__)return;
window.__VCCF_SUNDAY_STREAK_LOADER__=true;
let requested=false;
function dashboardActive(){return document.getElementById('dashboard')?.classList.contains('active')||document.querySelector('.nav [data-route="dashboard"].active')}
function loadSundayStreak(){
  if(requested||window.__VCCF_SUNDAY_STREAK__||document.querySelector('script[data-vccf-sunday-streak]'))return;
  requested=true;
  const script=document.createElement('script');
  script.src='/vccf-sunday-streak.js?v=20260916-2';
  script.defer=true;
  script.dataset.vccfSundayStreak='1';
  script.onerror=()=>{requested=false;script.remove()};
  document.head.appendChild(script);
}
function wake(){if(dashboardActive())loadSundayStreak()}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="dashboard"]'))setTimeout(loadSundayStreak,0)},true);
window.addEventListener('vccf-app-ready',()=>setTimeout(wake,200));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wake,500),{once:true});else setTimeout(wake,500);
})();

(()=>{
'use strict';
if(window.__VCCF_EVENTS_GALLERY_LOADER__)return;
window.__VCCF_EVENTS_GALLERY_LOADER__=true;
let requested=false;
function releaseStaleMount(){
  const host=document.getElementById('cmsContent');
  if(host?.dataset.vccfEventGallery==='1'&&!host.querySelector('.vccf-events-shell'))delete host.dataset.vccfEventGallery;
}
function eventsActive(){return document.getElementById('title')?.textContent?.trim()==='Events'||document.querySelector('.nav [data-route="events"].active')}
function loadEventsGallery(){
  releaseStaleMount();
  if(requested||window.__VCCF_EVENTS_GALLERY__||document.querySelector('script[data-vccf-events-gallery],script[data-vccfUxEventsGallery]'))return;
  requested=true;
  const script=document.createElement('script');
  script.src='/vccf-events-gallery.js?v=20260916-2';
  script.async=true;
  script.dataset.vccfEventsGallery='1';
  script.onload=()=>{releaseStaleMount()};
  script.onerror=()=>{requested=false;script.remove();console.error('Unable to load Events gallery module.')};
  document.head.appendChild(script);
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="events"]'))setTimeout(loadEventsGallery,0)},true);
window.addEventListener('vccf-app-ready',()=>{if(eventsActive())setTimeout(loadEventsGallery,120)});
})();

(()=>{
'use strict';
if(window.__VCCF_MODULE_HEALTH_LOADER__)return;
window.__VCCF_MODULE_HEALTH_LOADER__=true;
let requested=false;
function loadModuleHealth(){
  if(requested||window.__VCCF_MODULE_HEALTH__||document.querySelector('script[data-vccf-module-health]'))return;
  requested=true;
  const script=document.createElement('script');
  script.src='/vccf-module-health.js?v=20260916-1';
  script.defer=true;
  script.dataset.vccfModuleHealth='1';
  script.onerror=()=>{requested=false;script.remove();console.error('Unable to load VCCF module health guard.')};
  document.head.appendChild(script);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadModuleHealth,{once:true});else loadModuleHealth();
})();

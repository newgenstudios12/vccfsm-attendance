(()=>{
'use strict';
if(window.__VCCF_MEMBER_ENGAGEMENT_PHASE1__)return;
window.__VCCF_MEMBER_ENGAGEMENT_PHASE1__=true;

const V=()=>window.VCCF||null;
const DB=()=>V()?.sb||null;
const S=()=>V()?.getState?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(v)):'—';
let enabled=null,wallBusy=false,dashboardCount=null,dashboardCountAt=0,observer=null,timer=0;

async function featureEnabled(force=false){
  if(!S().session?.user?.id)return false;
  if(!force&&enabled!==null)return enabled;
  const db=DB();if(!db)return false;
  try{
    const {data,error}=await db.from('site_settings').select('value').eq('key','member_engagement_phase1_enabled').maybeSingle();
    if(error)throw error;
    enabled=String(data?.value||'').toLowerCase()==='true';
  }catch(e){console.warn('VCCF member engagement flag',e?.message||e);enabled=false;}
  return enabled;
}

function goPrayer(){
  const button=document.querySelector('[data-route="prayer"]');
  if(button){button.click();return true;}
  return false;
}

async function activePrayerCount(force=false){
  if(!force&&dashboardCount!==null&&Date.now()-dashboardCountAt<60000)return dashboardCount;
  const db=DB();if(!db)return 0;
  try{
    const {count,error}=await db.from('prayer_wall_posts').select('id',{count:'exact',head:true}).neq('status','Answered').neq('status','Closed');
    if(error)throw error;
    dashboardCount=Number(count||0);dashboardCountAt=Date.now();
  }catch(e){console.warn('VCCF prayer count',e?.message||e);dashboardCount=0;dashboardCountAt=Date.now();}
  return dashboardCount;
}

async function enhanceDashboard(){
  if(!(await featureEnabled()))return;
  const section=document.getElementById('vccfForYou');
  if(!section||!document.getElementById('dashboard')?.classList.contains('active'))return;
  const kicker=section.querySelector('.vccf-for-you-kicker');if(kicker)kicker.textContent='MY WEEK';
  const grid=section.querySelector('.vccf-for-you-grid');if(!grid||grid.querySelector('[data-vccf-prayer-card]'))return;
  const count=await activePrayerCount();
  if(!document.body.contains(grid)||grid.querySelector('[data-vccf-prayer-card]'))return;
  const card=document.createElement('article');
  card.className='vccf-for-you-card tone-prayer';
  card.dataset.vccfPrayerCard='1';
  card.innerHTML='<div class="vccf-for-you-icon" aria-hidden="true">🙏</div><div class="vccf-for-you-copy"><span>Prayer Wall</span><strong>'+esc(count+' prayer request'+(count===1?'':'s'))+'</strong><p>'+esc(count?'Pray with your church family and encourage someone today.':'Prayer requests shared with the church will appear here.')+'</p></div><button type="button" class="vccf-for-you-action">Open prayer wall <span aria-hidden="true">→</span></button>';
  card.querySelector('button').onclick=goPrayer;
  grid.appendChild(card);
}

async function loadWallData(){
  const db=DB();if(!db)return {posts:[],supported:new Set()};
  const [postsResult,supportResult]=await Promise.all([
    db.from('prayer_wall_posts').select('id,requester_label,request_text,category,status,answered_at,answered_note,prayer_count,created_at').order('created_at',{ascending:false}).limit(60),
    db.from('prayer_wall_supports').select('post_id')
  ]);
  if(postsResult.error)throw postsResult.error;
  if(supportResult.error)throw supportResult.error;
  return {posts:postsResult.data||[],supported:new Set((supportResult.data||[]).map(x=>x.post_id))};
}

function prayerCard(p,supported){
  const answered=String(p.status||'').toLowerCase()==='answered';
  const category=p.category||'Prayer';
  const count=Number(p.prayer_count||0);
  return '<article class="vccf-prayer-card '+(answered?'answered':'')+'" data-prayer-post="'+esc(p.id)+'">'+
    '<div class="vccf-prayer-meta"><div class="vccf-prayer-person"><div class="vccf-prayer-avatar" aria-hidden="true">🙏</div><div><strong>'+esc(p.requester_label||'VCCF Member')+'</strong><span>'+esc(category)+'</span></div></div><span class="vccf-prayer-status '+(answered?'answered':'')+'">'+esc(p.status||'Praying')+'</span></div>'+
    '<p class="vccf-prayer-text">'+esc(p.request_text||'')+'</p>'+
    (answered&&p.answered_note?'<div class="vccf-prayer-answer"><strong>Answered prayer</strong><br>'+esc(p.answered_note)+'</div>':'')+
    '<div class="vccf-prayer-card-foot"><span class="vccf-prayer-date">Shared '+esc(fmtDate(p.created_at))+'</span><button type="button" class="vccf-prayed-btn '+(supported?'active':'')+'" data-prayed-post="'+esc(p.id)+'" data-supported="'+(supported?'1':'0')+'">🙏 '+(supported?'Prayed':'I prayed')+' · '+esc(count)+'</button></div></article>';
}

async function togglePrayer(postId,button){
  if(wallBusy||!postId)return;
  const db=DB(),uid=S().session?.user?.id;if(!db||!uid)return;
  wallBusy=true;button.disabled=true;
  const supported=button.dataset.supported==='1';
  try{
    const result=supported
      ? await db.from('prayer_wall_supports').delete().eq('post_id',postId).eq('user_id',uid)
      : await db.from('prayer_wall_supports').insert({post_id:postId,user_id:uid});
    if(result.error)throw result.error;
    dashboardCountAt=0;
    await renderPrayerWall(true);
  }catch(e){
    console.warn('VCCF prayer support',e?.message||e);
    button.disabled=false;
  }finally{wallBusy=false;}
}

function decoratePrayerModal(){
  setTimeout(()=>{
    const modal=document.getElementById('cmsModal');if(!modal)return;
    const visibility=modal.querySelector('select[name="visibility"]');if(!visibility||modal.querySelector('.vccf-prayer-visibility-help'))return;
    const help=document.createElement('div');help.className='vccf-prayer-wall-note vccf-prayer-visibility-help';help.innerHTML='<strong>Sharing:</strong> Choose <b>Church</b> to place this request on the Prayer Wall. <b>Private</b> and <b>Leaders</b> stay restricted to the existing confidential prayer workflow.';
    visibility.closest('label')?.insertAdjacentElement('afterend',help);
  },30);
}

async function renderPrayerWall(force=false){
  if(!(await featureEnabled(force)))return;
  const content=document.getElementById('cmsContent');
  const onPrayer=String(document.getElementById('title')?.textContent||'').trim()==='Prayer Requests'||document.querySelector('[data-route="prayer"].active');
  if(!content||!onPrayer)return;
  let section=document.getElementById('vccfPrayerWall');
  if(section?.dataset.ready==='1'&&!force)return;
  if(!section){
    section=document.createElement('section');section.id='vccfPrayerWall';section.className='vccf-prayer-wall card';
    content.prepend(section);
  }
  section.dataset.ready='1';
  section.innerHTML='<div class="vccf-prayer-wall-head"><div><span class="vccf-prayer-wall-kicker">PRAY TOGETHER</span><h2>Church Prayer Wall</h2><p>Shared requests appear here without exposing private or leaders-only requests. Use “I prayed” as encouragement rather than a like or popularity score.</p></div><div class="vccf-prayer-wall-actions"><button id="vccfSharePrayer" type="button" class="btn">Share a prayer request</button></div></div><div class="vccf-prayer-wall-grid"><div class="vccf-prayer-empty">Loading prayer requests…</div></div><div class="vccf-prayer-wall-note">When adding a request, choose <b>Church</b> to share it here. Anonymous shared requests display only as “Anonymous”; the Prayer Wall never receives the requester’s member or user ID.</div>';
  document.getElementById('vccfSharePrayer').onclick=()=>{document.getElementById('addPrayer')?.click();decoratePrayerModal();};
  const grid=section.querySelector('.vccf-prayer-wall-grid');
  try{
    const {posts,supported}=await loadWallData();
    if(!document.body.contains(grid))return;
    grid.innerHTML=posts.length?posts.map(p=>prayerCard(p,supported.has(p.id))).join(''):'<div class="vccf-prayer-empty"><strong>No shared prayer requests yet.</strong><br>Use “Share a prayer request” and choose Church visibility when you want the church family to pray with you.</div>';
    grid.querySelectorAll('[data-prayed-post]').forEach(b=>b.onclick=()=>togglePrayer(b.dataset.prayedPost,b));
  }catch(e){
    grid.innerHTML='<div class="vccf-prayer-wall-error">The Prayer Wall could not load right now. Your existing Prayer Requests tools below are still available.</div>';
    console.warn('VCCF prayer wall',e?.message||e);
  }
}

function schedule(delay=120){clearTimeout(timer);timer=setTimeout(async()=>{await enhanceDashboard();await renderPrayerWall();},delay);}
function watch(){
  if(observer)return;
  observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='childList'))schedule(90);
  });
  observer.observe(document.body,{childList:true,subtree:true});
}
function boot(){watch();schedule(500);}

window.addEventListener('vccf-app-ready',()=>{enabled=null;dashboardCountAt=0;boot();});
window.addEventListener('vccf-signed-out',()=>{enabled=null;dashboardCount=null;dashboardCountAt=0;});
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-route="dashboard"],button[data-view="dashboard"]'))schedule(350);
  if(e.target.closest?.('[data-route="prayer"]'))schedule(350);
  if(e.target.closest?.('#addPrayer'))decoratePrayerModal();
});
window.VCCFMemberEngagement={refresh:async()=>{enabled=null;dashboardCountAt=0;await enhanceDashboard();await renderPrayerWall(true);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
})();

(()=>{'use strict';
if(window.__VCCF_PUBLIC_EVENT_POLICY__)return;
window.__VCCF_PUBLIC_EVENT_POLICY__=true;
const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const client=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let observer=null;
let queued=false;
const isVisibleEvent=(e,now=Date.now())=>{
  if(String(e?.status||'').toLowerCase()!=='scheduled')return false;
  const start=new Date(e.start_at).getTime();
  const end=e.end_at?new Date(e.end_at).getTime():start;
  return Number.isFinite(start)&&(start>=now||end>=now);
};
function renderEvents(rows){
  const grid=document.getElementById('eventsGrid');
  if(!grid)return;
  if(!rows.length){grid.innerHTML='<div class="empty">No upcoming church events are scheduled right now.</div>';return;}
  grid.innerHTML=rows.slice(0,12).map(e=>'<article class="event-card card"><div class="event-date"><span class="tag">Upcoming</span><strong>'+esc(fmt.format(new Date(e.start_at)))+'</strong></div><div class="event-body"><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||'Join the VCCF Santa Maria church family for this event.')+'</p><div class="meta-row">'+(e.location?'<span>⌖ '+esc(e.location)+'</span>':'')+(e.registration_required?'<span>Registration may be required</span>':'<span>No registration required</span>')+'</div></div></article>').join('');
}
function renderQuickEvent(event){
  const cards=[...document.querySelectorAll('#quickGrid .feature-card')];
  const card=cards.find(x=>x.querySelector('h3')?.textContent?.trim()==='Upcoming Event');
  if(!card)return;
  const p=card.querySelector('p'),meta=card.querySelector('.meta');
  if(event){if(p)p.textContent=event.title+(event.location?' · '+event.location:'');if(meta)meta.textContent=fmt.format(new Date(event.start_at));}
  else{if(p)p.textContent='Upcoming church events will appear here.';if(meta)meta.textContent='Check back soon';}
}
function attachObserver(){
  const targets=[document.getElementById('eventsGrid'),document.getElementById('quickGrid')].filter(Boolean);
  if(!targets.length)return;
  if(!observer)observer=new MutationObserver(()=>queuePolicy());
  observer.disconnect();
  targets.forEach(t=>observer.observe(t,{childList:true,subtree:true}));
}
function queuePolicy(){
  if(queued)return;
  queued=true;
  setTimeout(()=>{queued=false;applyPolicy();},0);
}
async function applyPolicy(){
  if(!client)return;
  try{
    const {data,error}=await client.from('church_events').select('id,title,description,start_at,end_at,location,registration_required,status').order('start_at',{ascending:true});
    if(error)throw error;
    const visible=(data||[]).filter(e=>isVisibleEvent(e));
    observer?.disconnect();
    renderEvents(visible);
    renderQuickEvent(visible[0]||null);
    attachObserver();
  }catch(error){
    console.warn('Public event policy:',error);
    attachObserver();
  }
}
function start(){attachObserver();queuePolicy();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(()=>{
'use strict';
if(window.__VCCF_MEMBER_ENGAGEMENT__)return;
window.__VCCF_MEMBER_ENGAGEMENT__=true;

if(!document.getElementById('vccfMemberEngagementExtendedCss')){
  const link=document.createElement('link');
  link.id='vccfMemberEngagementExtendedCss';
  link.rel='stylesheet';
  link.href='/vccf-member-engagement-extended.css?v=20260921-1';
  document.head.appendChild(link);
}

const V=()=>window.VCCF||null;
const DB=()=>V()?.sb||null;
const S=()=>V()?.getState?.()||{};
const uid=()=>S().session?.user?.id||null;
const role=()=>String(S().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayPH=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const KEYS=['member_engagement_phase2_enabled','member_engagement_phase4_enabled'];
let flags=null,flagsAt=0,observer=null,timer=0,sermonAt=0,lastPreviewId='';
let sermonMap=new Map();

async function loadFlags(force=false){
  if(!uid())return {};
  if(!force&&flags&&Date.now()-flagsAt<60000)return flags;
  const db=DB();if(!db)return {};
  try{
    const {data,error}=await db.from('site_settings').select('key,value').in('key',KEYS);
    if(error)throw error;
    flags=Object.fromEntries((data||[]).map(x=>[x.key,String(x.value||'').toLowerCase()==='true']));
    flagsAt=Date.now();
    return flags;
  }catch(e){console.warn('VCCF member engagement flags',e?.message||e);return flags||{};}
}
async function enabled(phase,force=false){const f=await loadFlags(force);return f['member_engagement_phase'+phase+'_enabled']===true;}

/* Phase 2 — Daily Devotional */
function devotionalStreak(rows){
  const set=new Set((rows||[]).map(x=>String(x.devotional_date||''))),today=todayPH();
  let d=new Date(today+'T12:00:00+08:00');
  if(!set.has(today))d.setDate(d.getDate()-1);
  let n=0;
  for(let i=0;i<366;i++){
    const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    if(!set.has(key))break;
    n++;d.setDate(d.getDate()-1);
  }
  return n;
}
async function getDevotionalData(){
  const db=DB(),date=todayPH();if(!db)return null;
  const start=new Date(date+'T12:00:00+08:00');start.setDate(start.getDate()-120);
  const startKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(start);
  const [dev,progress]=await Promise.all([
    db.from('daily_devotionals').select('*').eq('devotional_date',date).maybeSingle(),
    db.from('devotional_progress').select('devotional_date,completed_at').gte('devotional_date',startKey).order('devotional_date',{ascending:false})
  ]);
  if(dev.error)throw dev.error;if(progress.error)throw progress.error;
  const rows=progress.data||[];
  return {date,devotional:dev.data||null,done:rows.some(x=>x.devotional_date===date),streak:devotionalStreak(rows)};
}
async function markDevotionalComplete(button){
  if(!uid())return;button.disabled=true;
  try{
    const {error}=await DB().from('devotional_progress').insert({user_id:uid(),devotional_date:todayPH()});
    if(error&&error.code!=='23505')throw error;
    document.getElementById('vccfDevotionalBlock')?.remove();
    await renderDevotional(true);
  }catch(e){console.warn('VCCF devotional progress',e?.message||e);button.disabled=false;}
}
async function renderDevotional(force=false){
  if(!(await enabled(2,force)))return;
  const card=document.getElementById('vccfDailyVerseCard');
  if(!card||!document.getElementById('dashboard')?.classList.contains('active'))return;
  if(card.querySelector('#vccfDevotionalBlock')&&!force)return;
  try{
    const data=await getDevotionalData();if(!data)return;
    card.querySelector('#vccfDevotionalBlock')?.remove();
    const d=data.devotional||{},block=document.createElement('section');
    block.id='vccfDevotionalBlock';block.className='vccf-devotional';
    const title=d.title||'Pause. Reflect. Respond.';
    const reflection=d.reflection||'Read today’s verse slowly. Notice the word, phrase, or truth that stands out to you.';
    const question=d.reflection_question||'What is one practical response you can make today?';
    const prayer=d.prayer||'Take a moment to pray about what you are learning from today’s Word.';
    block.innerHTML='<div class="vccf-devotional-head"><div><span class="vccf-devotional-kicker">DAILY DEVOTIONAL</span><h3>'+esc(title)+'</h3></div><span class="vccf-devotional-streak">🔥 '+esc(data.streak)+' day'+(data.streak===1?'':'s')+'</span></div><div class="vccf-devotional-grid"><div class="vccf-devotional-box full"><strong>Reflect</strong><p>'+esc(reflection)+'</p></div><div class="vccf-devotional-box"><strong>Think about it</strong><p>'+esc(question)+'</p></div><div class="vccf-devotional-box"><strong>Prayer</strong><p>'+esc(prayer)+'</p></div></div><div class="vccf-devotional-actions"><span class="vccf-daily-verse-status">Your completion and streak are private to your account.</span><div>'+(canManage()?'<button type="button" class="btn secondary" id="vccfManageDevotional">Manage devotional</button> ':'')+'<button type="button" class="btn vccf-devotional-complete '+(data.done?'done':'')+'" id="vccfCompleteDevotional" '+(data.done?'disabled':'')+'>'+(data.done?'✓ Completed today':'Mark today complete')+'</button></div></div>';
    card.appendChild(block);
    block.querySelector('#vccfCompleteDevotional')?.addEventListener('click',e=>markDevotionalComplete(e.currentTarget));
    block.querySelector('#vccfManageDevotional')?.addEventListener('click',openDevotionalManager);
  }catch(e){console.warn('VCCF devotional',e?.message||e);}
}
function ensureDevotionalManager(){
  let modal=document.getElementById('vccfDevotionalManager');if(modal)return modal;
  modal=document.createElement('div');modal.id='vccfDevotionalManager';modal.className='vccf-devotional-manager';modal.hidden=true;
  modal.innerHTML='<div class="card vccf-devotional-dialog"><div class="vccf-devotional-dialog-head"><div><span class="vccf-devotional-kicker">CONTENT MANAGEMENT</span><h3>Daily Devotional</h3><p class="vccf-daily-verse-status">Add a short reflection around the existing Daily Verse. Leaving fields blank keeps the built-in reflection prompts.</p></div><button type="button" class="vccf-devotional-close" aria-label="Close">×</button></div><form class="vccf-devotional-form" id="vccfDevotionalForm"><label>Date<input type="date" name="devotional_date" required></label><label>Title<input name="title" placeholder="Optional devotional title"></label><label>Reflection<textarea name="reflection" placeholder="Short reflection"></textarea></label><label>Reflection question<textarea name="reflection_question" placeholder="Question for members"></textarea></label><label>Prayer prompt<textarea name="prayer" placeholder="Short prayer prompt"></textarea></label><label class="vccf-devotional-publish"><input type="checkbox" name="is_published"><span>Publish this devotional to members</span></label><div class="vccf-devotional-status" id="vccfDevotionalStatus"></div><div class="vccf-devotional-form-actions"><button type="button" class="btn secondary" id="vccfDeleteDevotional">Delete custom devotional</button><button type="submit" class="btn">Save devotional</button></div></form></div>';
  document.body.appendChild(modal);
  const close=()=>{modal.hidden=true;document.body.style.removeProperty('overflow');};
  modal.querySelector('.vccf-devotional-close').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close();};
  modal.querySelector('[name="devotional_date"]').onchange=e=>loadDevotionalManagerDate(e.currentTarget.value);
  modal.querySelector('#vccfDevotionalForm').onsubmit=saveDevotional;
  modal.querySelector('#vccfDeleteDevotional').onclick=deleteDevotional;
  return modal;
}
async function loadDevotionalManagerDate(date){
  const modal=ensureDevotionalManager(),db=DB(),form=modal.querySelector('form'),status=modal.querySelector('#vccfDevotionalStatus');if(!db||!date)return;
  status.textContent='Loading…';
  const {data,error}=await db.from('daily_devotionals').select('*').eq('devotional_date',date).maybeSingle();
  if(error){status.textContent=error.message;return;}
  form.elements.title.value=data?.title||'';
  form.elements.reflection.value=data?.reflection||'';
  form.elements.reflection_question.value=data?.reflection_question||'';
  form.elements.prayer.value=data?.prayer||'';
  form.elements.is_published.checked=data?.is_published===true;
  modal.querySelector('#vccfDeleteDevotional').hidden=!data;
  status.textContent=data?(data.is_published?'Published devotional loaded.':'Draft devotional loaded.'):'No custom devotional for this date. Built-in prompts will be used.';
}
async function openDevotionalManager(){
  if(!canManage())return;
  const modal=ensureDevotionalManager(),date=modal.querySelector('[name="devotional_date"]');
  date.value=todayPH();modal.hidden=false;document.body.style.overflow='hidden';
  await loadDevotionalManagerDate(date.value);
}
async function saveDevotional(e){
  e.preventDefault();if(!canManage()||!uid())return;
  const form=e.currentTarget,status=form.querySelector('#vccfDevotionalStatus'),button=form.querySelector('[type="submit"]'),date=form.elements.devotional_date.value;
  button.disabled=true;status.textContent='Saving…';
  try{
    const payload={devotional_date:date,title:form.elements.title.value.trim()||null,reflection:form.elements.reflection.value.trim()||null,reflection_question:form.elements.reflection_question.value.trim()||null,prayer:form.elements.prayer.value.trim()||null,is_published:form.elements.is_published.checked,created_by:uid(),updated_by:uid(),updated_at:new Date().toISOString()};
    const {error}=await DB().from('daily_devotionals').upsert(payload,{onConflict:'devotional_date'});if(error)throw error;
    status.textContent=payload.is_published?'Saved and published.':'Saved as draft.';
    if(date===todayPH()){document.getElementById('vccfDevotionalBlock')?.remove();await renderDevotional(true);}
    await loadDevotionalManagerDate(date);
  }catch(err){status.textContent=err.message||'Unable to save devotional.';}finally{button.disabled=false;}
}
async function deleteDevotional(){
  const modal=ensureDevotionalManager(),date=modal.querySelector('[name="devotional_date"]').value,status=modal.querySelector('#vccfDevotionalStatus');if(!date||!canManage())return;
  try{
    const {error}=await DB().from('daily_devotionals').delete().eq('devotional_date',date);if(error)throw error;
    status.textContent='Custom devotional removed. Built-in prompts will be used.';
    await loadDevotionalManagerDate(date);
    if(date===todayPH()){document.getElementById('vccfDevotionalBlock')?.remove();await renderDevotional(true);}
  }catch(e){status.textContent=e.message||'Unable to delete devotional.';}
}

/* Phase 4 — Interactive Sermons */
async function loadSermonEngagement(force=false){
  if(!force&&Date.now()-sermonAt<60000)return sermonMap;
  const db=DB();if(!db||!uid())return sermonMap;
  try{
    const {data,error}=await db.from('sermon_member_engagement').select('sermon_id,bookmarked,notes,reflection,updated_at');if(error)throw error;
    sermonMap=new Map((data||[]).map(x=>[x.sermon_id,x]));sermonAt=Date.now();
  }catch(e){console.warn('VCCF sermon engagement',e?.message||e);}
  return sermonMap;
}
function paintBookmark(button,row){if(!button)return;const saved=row?.bookmarked===true;button.classList.toggle('saved',saved);button.textContent=saved?'♥ Saved':'♡ Save';}
async function decorateSermonCards(force=false){
  if(!(await enabled(4,force)))return;
  const cards=[...document.querySelectorAll('[data-sermon-card]')];if(!cards.length)return;
  const map=await loadSermonEngagement(force);
  cards.forEach(card=>{
    const id=card.dataset.sermonCard,actions=card.querySelector('.sermon-card-actions');if(!id||!actions)return;
    let b=actions.querySelector('[data-vccf-sermon-save]');
    if(!b){b=document.createElement('button');b.type='button';b.className='vccf-sermon-save';b.dataset.vccfSermonSave=id;actions.prepend(b);}
    paintBookmark(b,map.get(id));
  });
}
async function toggleSermonBookmark(id,button){
  if(!id||!uid())return;button.disabled=true;
  try{
    const current=sermonMap.get(id)||{},next=current.bookmarked!==true;
    const payload={user_id:uid(),sermon_id:id,bookmarked:next,notes:current.notes||null,reflection:current.reflection||null,updated_at:new Date().toISOString()};
    const {data,error}=await DB().from('sermon_member_engagement').upsert(payload,{onConflict:'user_id,sermon_id'}).select('sermon_id,bookmarked,notes,reflection,updated_at').single();if(error)throw error;
    sermonMap.set(id,data);sermonAt=Date.now();paintBookmark(button,data);
    const panel=document.querySelector('#vccfSermonEngagement[data-sermon-id="'+CSS.escape(id)+'"]');
    const previewButton=panel?.querySelector('[data-preview-bookmark]');if(previewButton)paintBookmark(previewButton,data);
  }catch(e){console.warn('VCCF sermon bookmark',e?.message||e);}finally{button.disabled=false;}
}
async function decorateSermonPreview(force=false){
  if(!(await enabled(4,force))||!lastPreviewId)return;
  const modal=document.getElementById('sermonPreviewModal');if(!modal||modal.querySelector('#vccfSermonEngagement'))return;
  const map=await loadSermonEngagement(force),row=map.get(lastPreviewId)||{},panel=document.createElement('section');
  panel.id='vccfSermonEngagement';panel.className='vccf-sermon-engagement';panel.dataset.sermonId=lastPreviewId;
  panel.innerHTML='<span class="vccf-sermon-engagement-kicker">MY SERMON SPACE</span><h4>Private notes & reflection</h4><p>These notes are visible only to your signed-in account.</p><div class="vccf-sermon-engagement-grid"><label>My notes<textarea name="notes" placeholder="Key points, scriptures, reminders…">'+esc(row.notes||'')+'</textarea></label><label>My reflection<textarea name="reflection" placeholder="Write your response…">'+esc(row.reflection||'')+'</textarea></label><div class="vccf-sermon-reflection-prompt"><strong>Weekly reflection:</strong> What is one thing from this message that you will apply this week?</div><div class="vccf-sermon-engagement-actions"><span class="vccf-sermon-engagement-status"></span><button type="button" class="vccf-sermon-save" data-preview-bookmark="1"></button><button type="button" class="btn" data-save-sermon-notes="1">Save my notes</button></div></div>';
  modal.querySelector('.sermon-preview-actions')?.insertAdjacentElement('beforebegin',panel);
  paintBookmark(panel.querySelector('[data-preview-bookmark]'),row);
  panel.querySelector('[data-preview-bookmark]').onclick=e=>toggleSermonBookmark(lastPreviewId,e.currentTarget);
  panel.querySelector('[data-save-sermon-notes]').onclick=e=>saveSermonNotes(lastPreviewId,panel,e.currentTarget);
}
async function saveSermonNotes(id,panel,button){
  if(!id||!uid())return;
  const status=panel.querySelector('.vccf-sermon-engagement-status'),current=sermonMap.get(id)||{};
  button.disabled=true;status.textContent='Saving…';
  try{
    const payload={user_id:uid(),sermon_id:id,bookmarked:current.bookmarked===true,notes:panel.querySelector('[name="notes"]').value.trim()||null,reflection:panel.querySelector('[name="reflection"]').value.trim()||null,updated_at:new Date().toISOString()};
    const {data,error}=await DB().from('sermon_member_engagement').upsert(payload,{onConflict:'user_id,sermon_id'}).select('sermon_id,bookmarked,notes,reflection,updated_at').single();if(error)throw error;
    sermonMap.set(id,data);sermonAt=Date.now();status.textContent='Saved privately.';
  }catch(e){status.textContent=e.message||'Unable to save notes.';}finally{button.disabled=false;}
}

async function renderAll(force=false){
  if(!uid())return;
  await loadFlags(force);
  await Promise.allSettled([renderDevotional(force),decorateSermonCards(force),decorateSermonPreview(force)]);
}
function schedule(delay=120,force=false){clearTimeout(timer);timer=setTimeout(()=>renderAll(force),delay);}
function watch(){if(observer)return;observer=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))schedule(100,false);});observer.observe(document.body,{childList:true,subtree:true});}
function reset(){flags=null;flagsAt=0;sermonAt=0;sermonMap=new Map();lastPreviewId='';}
function boot(){watch();schedule(500,false);}

window.addEventListener('vccf-app-ready',()=>{reset();boot();});
window.addEventListener('vccf-signed-out',reset);
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-route="dashboard"],button[data-view="dashboard"]'))schedule(350,false);
  if(e.target.closest?.('[data-route="sermons"]'))schedule(350,false);
  const save=e.target.closest?.('[data-vccf-sermon-save]');if(save){e.preventDefault();e.stopPropagation();void toggleSermonBookmark(save.dataset.vccfSermonSave,save);}
  const preview=e.target.closest?.('[data-sermon-preview]');if(preview){lastPreviewId=preview.dataset.sermonPreview||'';setTimeout(()=>decorateSermonPreview(false),80);}
},true);
window.VCCFMemberEngagement={refresh:async()=>{reset();await renderAll(true);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
})();
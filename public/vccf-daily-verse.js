(()=>{
'use strict';
if(window.__VCCF_DAILY_VERSE__)return;
window.__VCCF_DAILY_VERSE__=true;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayPH=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const role=()=>String(window.VCCF?.getState?.()?.profile?.role||'').toLowerCase();
const canManage=()=>['admin','pastor'].includes(role());
let loading=false,lastDate='';

const translationMeta={
  NIV:{label:'NIV',name:'New International Version',publisher:'Biblica',note:'NIV is copyrighted by Biblica. Paste only verse text VCCF is permitted to display and distribute.'},
  ESV:{label:'ESV',name:'English Standard Version',publisher:'Crossway',note:'ESV is copyrighted by Crossway. Paste only verse text VCCF is permitted to display and distribute.'},
  RTPV05:{label:'RTPV',name:'Magandang Balita Bible (Revised)',publisher:'Philippine Bible Society',note:'RTPV05 / Magandang Balita Bible is published by the Philippine Bible Society. Paste only text VCCF is authorized to use.'},
  KJV:{label:'KJV',name:'King James Version',publisher:'Public-domain fallback',note:'KJV remains the automatic fallback when no custom verse is scheduled.'}
};

function styles(){
  if(document.getElementById('vccfDailyVerseStyles'))return;
  const s=document.createElement('style');s.id='vccfDailyVerseStyles';s.textContent=`
.vccf-daily-verse{position:relative;overflow:hidden;margin:0 0 16px;padding:clamp(20px,3vw,30px);border:1px solid color-mix(in srgb,var(--brand) 18%,var(--line));background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 7%,var(--card)),color-mix(in srgb,var(--brand2) 8%,var(--card)));box-shadow:var(--shadow);isolation:isolate}
.vccf-daily-verse:after{content:'“';position:absolute;right:18px;top:-28px;font-family:Georgia,serif;font-size:9rem;line-height:1;color:color-mix(in srgb,var(--brand) 10%,transparent);z-index:-1;pointer-events:none}
.vccf-daily-verse-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.vccf-daily-verse-kicker{display:flex;align-items:center;gap:9px;font-size:.73rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--brand)}
.vccf-daily-verse-icon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--brand) 11%,var(--card));font-size:1rem}.vccf-daily-verse-date{font-size:.72rem;color:var(--muted);font-weight:700}
.vccf-daily-verse-text{margin:0;max-width:980px;font-family:'Plus Jakarta Sans',Manrope,system-ui,sans-serif;font-size:clamp(1.08rem,2vw,1.42rem);font-weight:700;line-height:1.6;color:var(--text)}
.vccf-daily-verse-reference{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:13px;font-size:.82rem}.vccf-daily-verse-reference strong{font-size:.9rem;color:var(--text)}.vccf-daily-verse-translation{padding:4px 7px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:.65rem;font-weight:900}.vccf-daily-verse-publisher{font-size:.68rem;color:var(--muted)}
.vccf-daily-verse-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--line) 75%,transparent)}.vccf-daily-verse-note{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:.72rem;line-height:1.45}.vccf-daily-verse-actions{display:flex;gap:8px;flex-wrap:wrap}.vccf-daily-verse-copy,.vccf-daily-verse-manage{min-height:36px;padding:8px 12px;font-size:.72rem}.vccf-daily-verse-status{font-size:.72rem;color:var(--muted)}
.vccf-verse-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(4px)}.vccf-verse-modal[hidden]{display:none!important}.vccf-verse-dialog{width:min(760px,100%);max-height:min(88vh,860px);overflow:auto;border:1px solid var(--line);border-radius:22px;background:var(--card);color:var(--text);box-shadow:0 24px 70px rgba(15,23,42,.28)}
.vccf-verse-dialog-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 20px 14px;background:var(--card);border-bottom:1px solid var(--line)}.vccf-verse-dialog-head h2{margin:0;font-size:1.15rem}.vccf-verse-dialog-head p{margin:5px 0 0;color:var(--muted);font-size:.76rem;line-height:1.45}.vccf-verse-close{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;width:36px;height:36px;font-weight:900;cursor:pointer}
.vccf-verse-dialog-body{padding:20px}.vccf-verse-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.vccf-verse-field{display:grid;gap:6px}.vccf-verse-field.full{grid-column:1/-1}.vccf-verse-field label{font-size:.74rem;font-weight:900}.vccf-verse-field input,.vccf-verse-field select,.vccf-verse-field textarea{width:100%;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--text);padding:11px 12px;outline:none}.vccf-verse-field textarea{min-height:130px;resize:vertical;line-height:1.55}.vccf-verse-field input:focus,.vccf-verse-field select:focus,.vccf-verse-field textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 10%,transparent)}
.vccf-verse-rights{grid-column:1/-1;padding:11px 12px;border-radius:11px;background:color-mix(in srgb,var(--brand) 6%,var(--card));border:1px solid color-mix(in srgb,var(--brand) 13%,var(--line));font-size:.72rem;color:var(--muted);line-height:1.5}.vccf-verse-switch{grid-column:1/-1;display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid var(--line);border-radius:11px}.vccf-verse-switch input{margin-top:2px}.vccf-verse-switch strong{display:block;font-size:.78rem}.vccf-verse-switch span{display:block;color:var(--muted);font-size:.68rem;margin-top:3px;line-height:1.45}
.vccf-verse-form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;padding-top:4px}.vccf-verse-save-status{grid-column:1/-1;min-height:18px;font-size:.72rem}.vccf-verse-upcoming{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.vccf-verse-upcoming h3{margin:0 0 10px;font-size:.88rem}.vccf-verse-list{display:grid;gap:8px}.vccf-verse-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:10px 12px;text-align:left;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--text);cursor:pointer}.vccf-verse-list-main{min-width:0}.vccf-verse-list-main strong{display:block;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vccf-verse-list-main span{display:block;margin-top:3px;font-size:.66rem;color:var(--muted)}.vccf-verse-empty{padding:12px;color:var(--muted);font-size:.72rem;border:1px dashed var(--line);border-radius:11px}
@media(max-width:600px){.vccf-daily-verse{border-radius:18px;padding:19px}.vccf-daily-verse-head{align-items:flex-start}.vccf-daily-verse-date{text-align:right}.vccf-daily-verse-foot{align-items:stretch}.vccf-daily-verse-actions,.vccf-daily-verse-copy,.vccf-daily-verse-manage{width:100%}.vccf-daily-verse-actions{display:grid}.vccf-verse-modal{padding:8px}.vccf-verse-dialog{max-height:94vh;border-radius:18px}.vccf-verse-dialog-head,.vccf-verse-dialog-body{padding:16px}.vccf-verse-form-grid{grid-template-columns:1fr}.vccf-verse-field.full,.vccf-verse-rights,.vccf-verse-switch,.vccf-verse-form-actions,.vccf-verse-save-status{grid-column:1}.vccf-verse-form-actions{display:grid}.vccf-verse-form-actions .btn{width:100%}}
`;document.head.appendChild(s);
}

function ensureCard(){
  styles();const dashboard=document.getElementById('dashboard');if(!dashboard)return null;
  let card=document.getElementById('vccfDailyVerseCard');
  if(!card){
    card=document.createElement('section');card.id='vccfDailyVerseCard';card.className='card vccf-daily-verse';card.setAttribute('aria-live','polite');
    const anchor=dashboard.querySelector('.stats')||dashboard.firstElementChild;dashboard.insertBefore(card,anchor||null);
  }
  return card;
}

function niceDate(value){
  const d=new Date(`${value}T12:00:00+08:00`);
  return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric'}).format(d);
}

function metaFor(code){return translationMeta[code]||{label:code||'Bible',name:code||'',publisher:'',note:''};}

async function copyVerse(text,button){
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    const old=button.textContent;button.textContent='Copied';setTimeout(()=>{if(button.isConnected)button.textContent=old},1400);
  }catch(_){button.textContent='Copy failed';setTimeout(()=>{if(button.isConnected)button.textContent='Copy verse'},1400);}
}

function ensureManager(){
  if(!canManage())return null;
  let modal=document.getElementById('vccfVerseManager');if(modal)return modal;
  modal=document.createElement('div');modal.id='vccfVerseManager';modal.className='vccf-verse-modal';modal.hidden=true;
  modal.innerHTML=`<div class="vccf-verse-dialog" role="dialog" aria-modal="true" aria-labelledby="vccfVerseManagerTitle"><div class="vccf-verse-dialog-head"><div><h2 id="vccfVerseManagerTitle">Daily Verse Manager</h2><p>Admin/Pastor can schedule a verse and translation for any date. Unsheduled dates continue using the KJV fallback rotation.</p></div><button class="vccf-verse-close" type="button" aria-label="Close">×</button></div><div class="vccf-verse-dialog-body"><form id="vccfVerseForm" class="vccf-verse-form-grid"><div class="vccf-verse-field"><label for="vccfVerseDate">Date</label><input id="vccfVerseDate" type="date" required></div><div class="vccf-verse-field"><label for="vccfVerseTranslation">Translation</label><select id="vccfVerseTranslation"><option value="NIV">NIV — New International Version</option><option value="ESV">ESV — English Standard Version</option><option value="RTPV05">RTPV — Magandang Balita Bible (Revised)</option><option value="KJV">KJV — fallback / public domain</option></select></div><div class="vccf-verse-field full"><label for="vccfVerseReference">Bible reference</label><input id="vccfVerseReference" type="text" placeholder="e.g. John 3:16" required></div><div class="vccf-verse-field full"><label for="vccfVerseText">Verse text</label><textarea id="vccfVerseText" placeholder="Paste the exact verse text from the selected translation…" required></textarea></div><div id="vccfVerseRights" class="vccf-verse-rights"></div><label class="vccf-verse-switch"><input id="vccfVersePush" type="checkbox" checked><span><strong>Send as a daily push notification</strong><span>The scheduled verse is prepared at 7:00 AM Philippine time and uses the existing VCCF notification inbox/push system.</span></span></label><div id="vccfVerseStatus" class="vccf-verse-save-status"></div><div class="vccf-verse-form-actions"><button id="vccfVerseRemove" class="btn secondary" type="button" hidden>Remove scheduled verse</button><button class="btn" type="submit">Save Daily Verse</button></div></form><section class="vccf-verse-upcoming"><h3>Upcoming scheduled verses</h3><div id="vccfVerseList" class="vccf-verse-list"><div class="vccf-verse-empty">Loading…</div></div></section></div></div>`;
  document.body.appendChild(modal);
  const close=()=>{modal.hidden=true;document.body.style.removeProperty('overflow');};
  modal.querySelector('.vccf-verse-close')?.addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();});
  modal.querySelector('#vccfVerseTranslation')?.addEventListener('change',updateRights);
  modal.querySelector('#vccfVerseDate')?.addEventListener('change',e=>void loadManagerDate(e.currentTarget.value));
  modal.querySelector('#vccfVerseForm')?.addEventListener('submit',saveManagerVerse);
  modal.querySelector('#vccfVerseRemove')?.addEventListener('click',removeManagerVerse);
  updateRights();
  return modal;
}

function updateRights(){
  const modal=document.getElementById('vccfVerseManager');if(!modal)return;
  const code=modal.querySelector('#vccfVerseTranslation')?.value||'NIV';const m=metaFor(code);
  const rights=modal.querySelector('#vccfVerseRights');if(rights)rights.innerHTML=`<strong>${esc(m.name)}</strong> · ${esc(m.publisher)}<br>${esc(m.note)} VCCF Connect does not download or auto-convert copyrighted Bible text.`;
}

async function loadManagerDate(date){
  const modal=ensureManager(),client=window.VCCF?.sb;if(!modal||!client||!date)return;
  const status=modal.querySelector('#vccfVerseStatus'),remove=modal.querySelector('#vccfVerseRemove');if(status){status.textContent='Loading scheduled verse…';status.style.color='var(--muted)';}
  const {data,error}=await client.from('daily_bible_verse_selections').select('verse_date,reference,verse_text,translation,push_enabled').eq('verse_date',date).maybeSingle();
  if(error){if(status){status.textContent=error.message;status.style.color='#b42318';}return;}
  modal.querySelector('#vccfVerseReference').value=data?.reference||'';
  modal.querySelector('#vccfVerseText').value=data?.verse_text||'';
  modal.querySelector('#vccfVerseTranslation').value=data?.translation||'NIV';
  modal.querySelector('#vccfVersePush').checked=data?.push_enabled!==false;
  if(remove)remove.hidden=!data;
  if(status){status.textContent=data?'Scheduled verse loaded.':'No custom verse is scheduled for this date. KJV fallback will be used.';status.style.color='var(--muted)';}
  updateRights();
}

async function loadUpcoming(){
  const modal=ensureManager(),client=window.VCCF?.sb;if(!modal||!client)return;
  const list=modal.querySelector('#vccfVerseList');if(!list)return;
  const {data,error}=await client.from('daily_bible_verse_selections').select('verse_date,reference,translation,push_enabled').gte('verse_date',todayPH()).order('verse_date',{ascending:true}).limit(12);
  if(error){list.innerHTML=`<div class="vccf-verse-empty">${esc(error.message)}</div>`;return;}
  if(!data?.length){list.innerHTML='<div class="vccf-verse-empty">No upcoming custom verses yet. The KJV fallback rotation will continue automatically.</div>';return;}
  list.innerHTML=data.map(v=>{const m=metaFor(v.translation);return `<button type="button" class="vccf-verse-list-item" data-date="${esc(v.verse_date)}"><span class="vccf-verse-list-main"><strong>${esc(v.reference)}</strong><span>${esc(niceDate(v.verse_date))} · ${esc(m.label)}${v.push_enabled?' · Push on':' · Push off'}</span></span><span aria-hidden="true">›</span></button>`;}).join('');
  list.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.date;modal.querySelector('#vccfVerseDate').value=d;void loadManagerDate(d);modal.querySelector('#vccfVerseDate').scrollIntoView({behavior:'smooth',block:'center'});}));
}

async function openManager(){
  const modal=ensureManager();if(!modal)return;
  modal.hidden=false;document.body.style.overflow='hidden';
  const date=modal.querySelector('#vccfVerseDate');date.value=date.value||todayPH();
  await Promise.all([loadManagerDate(date.value),loadUpcoming()]);
}

async function saveManagerVerse(event){
  event.preventDefault();
  const modal=ensureManager(),client=window.VCCF?.sb;if(!modal||!client||!canManage())return;
  const date=modal.querySelector('#vccfVerseDate').value;
  const reference=modal.querySelector('#vccfVerseReference').value.trim();
  const verse_text=modal.querySelector('#vccfVerseText').value.trim();
  const translation=modal.querySelector('#vccfVerseTranslation').value;
  const push_enabled=modal.querySelector('#vccfVersePush').checked;
  const status=modal.querySelector('#vccfVerseStatus');
  if(!date||!reference||!verse_text){if(status){status.textContent='Date, Bible reference, and verse text are required.';status.style.color='#b42318';}return;}
  if(status){status.textContent='Saving…';status.style.color='var(--muted)';}
  const uid=window.VCCF?.getState?.()?.session?.user?.id||null;
  const {error}=await client.from('daily_bible_verse_selections').upsert({verse_date:date,reference,verse_text,translation,push_enabled,created_by:uid,updated_by:uid,updated_at:new Date().toISOString()},{onConflict:'verse_date'});
  if(error){if(status){status.textContent=error.message;status.style.color='#b42318';}return;}
  if(status){status.textContent=`Saved for ${niceDate(date)}${push_enabled?' · push enabled at 7:00 AM PHT':' · push disabled'}.`;status.style.color='#167647';}
  const remove=modal.querySelector('#vccfVerseRemove');if(remove)remove.hidden=false;
  await loadUpcoming();if(date===todayPH())await render(true);
}

async function removeManagerVerse(){
  const modal=ensureManager(),client=window.VCCF?.sb;if(!modal||!client||!canManage())return;
  const date=modal.querySelector('#vccfVerseDate').value;if(!date)return;
  if(!window.confirm(`Remove the custom Daily Verse for ${niceDate(date)}? The KJV fallback will be used instead.`))return;
  const status=modal.querySelector('#vccfVerseStatus');if(status){status.textContent='Removing…';status.style.color='var(--muted)';}
  const {error}=await client.from('daily_bible_verse_selections').delete().eq('verse_date',date);
  if(error){if(status){status.textContent=error.message;status.style.color='#b42318';}return;}
  await loadManagerDate(date);await loadUpcoming();if(date===todayPH())await render(true);
}

async function render(force=false){
  const card=ensureCard();if(!card)return;
  const date=todayPH();if(loading||(!force&&lastDate===date&&card.dataset.loaded==='1'))return;
  const client=window.VCCF?.sb;if(!client){card.innerHTML='<div class="vccf-daily-verse-status">Loading Today’s Word…</div>';return;}
  loading=true;card.innerHTML='<div class="vccf-daily-verse-status">Loading Today’s Word…</div>';
  try{
    const {data,error}=await client.rpc('vccf_daily_bible_verse',{p_date:date});if(error)throw error;
    const verse=Array.isArray(data)?data[0]:data;if(!verse)throw new Error('No daily verse available.');
    const m=metaFor(verse.translation||'KJV');
    const quote=`${verse.verse_text} — ${verse.reference} (${m.label})`;
    const manage=canManage()?'<button class="btn secondary vccf-daily-verse-manage" type="button">Manage Daily Verse</button>':'';
    card.innerHTML=`<div class="vccf-daily-verse-head"><div class="vccf-daily-verse-kicker"><span class="vccf-daily-verse-icon" aria-hidden="true">✦</span><span>Today’s Word</span></div><div class="vccf-daily-verse-date">${esc(niceDate(verse.verse_date||date))}</div></div><blockquote class="vccf-daily-verse-text">${esc(verse.verse_text)}</blockquote><div class="vccf-daily-verse-reference"><strong>${esc(verse.reference)}</strong><span class="vccf-daily-verse-translation">${esc(m.label)}</span><span class="vccf-daily-verse-publisher">${esc(m.publisher)}</span></div><div class="vccf-daily-verse-foot"><div class="vccf-daily-verse-note"><span aria-hidden="true">🔔</span><span>Changes daily · Daily verse notification at 7:00 AM Philippine time on registered devices.</span></div><div class="vccf-daily-verse-actions">${manage}<button class="btn secondary vccf-daily-verse-copy" type="button">Copy verse</button></div></div>`;
    card.dataset.loaded='1';lastDate=date;
    card.querySelector('.vccf-daily-verse-copy')?.addEventListener('click',e=>copyVerse(quote,e.currentTarget));
    card.querySelector('.vccf-daily-verse-manage')?.addEventListener('click',()=>void openManager());
  }catch(error){card.innerHTML='<div class="vccf-daily-verse-head"><div class="vccf-daily-verse-kicker"><span class="vccf-daily-verse-icon" aria-hidden="true">✦</span><span>Today’s Word</span></div></div><div class="vccf-daily-verse-status">Today’s Word is unavailable right now.</div>';console.warn('[VCCF daily verse]',error);}
  finally{loading=false;}
}

function init(){if(!document.getElementById('dashboard'))return;void render(true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('vccf-authenticated',()=>setTimeout(()=>void render(true),120));
window.addEventListener('vccf-app-ready',()=>setTimeout(()=>void render(true),160));
window.addEventListener('focus',()=>void render(false));
new MutationObserver(()=>{if(!document.getElementById('vccfDailyVerseCard')&&document.getElementById('dashboard'))void render(false);}).observe(document.body,{childList:true,subtree:true});
window.VCCFDailyVerse={refresh:()=>render(true),manage:()=>openManager()};
})();

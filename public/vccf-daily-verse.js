(()=>{
'use strict';
if(window.__VCCF_DAILY_VERSE__)return;
window.__VCCF_DAILY_VERSE__=true;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayPH=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let loading=false,lastDate='';

function styles(){
  if(document.getElementById('vccfDailyVerseStyles'))return;
  const s=document.createElement('style');s.id='vccfDailyVerseStyles';s.textContent=`
.vccf-daily-verse{position:relative;overflow:hidden;margin:0 0 16px;padding:clamp(20px,3vw,30px);border:1px solid color-mix(in srgb,var(--brand) 18%,var(--line));background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 7%,var(--card)),color-mix(in srgb,var(--brand2) 8%,var(--card)));box-shadow:var(--shadow);isolation:isolate}
.vccf-daily-verse:after{content:'“';position:absolute;right:18px;top:-28px;font-family:Georgia,serif;font-size:9rem;line-height:1;color:color-mix(in srgb,var(--brand) 10%,transparent);z-index:-1;pointer-events:none}
.vccf-daily-verse-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.vccf-daily-verse-kicker{display:flex;align-items:center;gap:9px;font-size:.73rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--brand)}
.vccf-daily-verse-icon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--brand) 11%,var(--card));font-size:1rem}.vccf-daily-verse-date{font-size:.72rem;color:var(--muted);font-weight:700}
.vccf-daily-verse-text{margin:0;max-width:980px;font-family:'Plus Jakarta Sans',Manrope,system-ui,sans-serif;font-size:clamp(1.08rem,2vw,1.42rem);font-weight:700;line-height:1.6;color:var(--text)}
.vccf-daily-verse-reference{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:13px;font-size:.82rem}.vccf-daily-verse-reference strong{font-size:.9rem;color:var(--text)}.vccf-daily-verse-translation{padding:4px 7px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:.65rem;font-weight:900}
.vccf-daily-verse-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--line) 75%,transparent)}.vccf-daily-verse-note{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:.72rem;line-height:1.45}.vccf-daily-verse-copy{min-height:36px;padding:8px 12px;font-size:.72rem}.vccf-daily-verse-status{font-size:.72rem;color:var(--muted)}
@media(max-width:600px){.vccf-daily-verse{border-radius:18px;padding:19px}.vccf-daily-verse-head{align-items:flex-start}.vccf-daily-verse-date{text-align:right}.vccf-daily-verse-foot{align-items:stretch}.vccf-daily-verse-copy{width:100%}}
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

async function copyVerse(text,button){
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    const old=button.textContent;button.textContent='Copied';setTimeout(()=>{if(button.isConnected)button.textContent=old},1400);
  }catch(_){button.textContent='Copy failed';setTimeout(()=>{if(button.isConnected)button.textContent='Copy verse'},1400);}
}

async function render(force=false){
  const card=ensureCard();if(!card)return;
  const date=todayPH();if(loading||(!force&&lastDate===date&&card.dataset.loaded==='1'))return;
  const client=window.VCCF?.sb;if(!client){card.innerHTML='<div class="vccf-daily-verse-status">Loading Today’s Word…</div>';return;}
  loading=true;card.innerHTML='<div class="vccf-daily-verse-status">Loading Today’s Word…</div>';
  try{
    const {data,error}=await client.rpc('vccf_daily_bible_verse',{p_date:date});if(error)throw error;
    const verse=Array.isArray(data)?data[0]:data;if(!verse)throw new Error('No daily verse available.');
    const quote=`${verse.verse_text} — ${verse.reference} (${verse.translation||'KJV'})`;
    card.innerHTML=`<div class="vccf-daily-verse-head"><div class="vccf-daily-verse-kicker"><span class="vccf-daily-verse-icon" aria-hidden="true">✦</span><span>Today’s Word</span></div><div class="vccf-daily-verse-date">${esc(niceDate(verse.verse_date||date))}</div></div><blockquote class="vccf-daily-verse-text">${esc(verse.verse_text)}</blockquote><div class="vccf-daily-verse-reference"><strong>${esc(verse.reference)}</strong><span class="vccf-daily-verse-translation">${esc(verse.translation||'KJV')}</span></div><div class="vccf-daily-verse-foot"><div class="vccf-daily-verse-note"><span aria-hidden="true">🔔</span><span>Changes daily · Daily verse notification at 7:00 AM Philippine time on registered devices.</span></div><button class="btn secondary vccf-daily-verse-copy" type="button">Copy verse</button></div>`;
    card.dataset.loaded='1';lastDate=date;
    card.querySelector('.vccf-daily-verse-copy')?.addEventListener('click',e=>copyVerse(quote,e.currentTarget));
  }catch(error){card.innerHTML='<div class="vccf-daily-verse-head"><div class="vccf-daily-verse-kicker"><span class="vccf-daily-verse-icon" aria-hidden="true">✦</span><span>Today’s Word</span></div></div><div class="vccf-daily-verse-status">Today’s Word is unavailable right now.</div>';console.warn('[VCCF daily verse]',error);}
  finally{loading=false;}
}

function init(){if(!document.getElementById('dashboard'))return;void render(true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('vccf-authenticated',()=>setTimeout(()=>void render(true),120));
window.addEventListener('vccf-app-ready',()=>setTimeout(()=>void render(true),160));
window.addEventListener('focus',()=>void render(false));
new MutationObserver(()=>{if(!document.getElementById('vccfDailyVerseCard')&&document.getElementById('dashboard'))void render(false);}).observe(document.body,{childList:true,subtree:true});
window.VCCFDailyVerse={refresh:()=>render(true)};
})();

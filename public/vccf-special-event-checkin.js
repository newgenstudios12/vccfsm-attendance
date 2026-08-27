(()=>{
'use strict';
if(window.__VCCF_SPECIAL_EVENT_CHECKIN_V1__)return;
window.__VCCF_SPECIAL_EVENT_CHECKIN_V1__=true;
const URL=window.VCCF_SUPABASE_URL,KEY=window.VCCF_SUPABASE_PUBLISHABLE_KEY;
if(!URL||!KEY||!window.supabase)return;
const client=window.supabase.createClient(URL,KEY);
let currentEventId=null;
let scanner=null;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfSeCheckToast);window.__vccfSeCheckToast=setTimeout(()=>x.classList.remove('show'),2800)}};
const normalize=v=>String(v||'').trim().toLowerCase();
const findEventId=()=>currentEventId||document.querySelector('#vccfSpecialEventSession [data-se-event-id]')?.dataset.seEventId||null;
async function checkIn(eventId,memberId,source){if(!eventId||!memberId)return false;const {error}=await client.rpc('set_special_event_attendance',{p_event_id:eventId,p_member_id:memberId,p_source:source||'manual'});if(error){toast(error.message||'Unable to check in member.');return false}toast('Member checked in.');return true}
async function lookupMember(raw){const value=String(raw||'').trim();if(!value)return null;let parsed=value;try{const j=JSON.parse(value);parsed=j?.member_id||j?.memberId||j?.member_code||j?.memberCode||j?.id||j?.code||j?.member||value}catch{};
let r=await client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').eq('id',parsed).maybeSingle();if(r.data)return r.data;
r=await client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').eq('member_code',parsed).maybeSingle();if(r.data)return r.data;
r=await client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').eq('display_name',parsed).maybeSingle();if(r.data)return r.data;
const {data}=await client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').ilike('display_name',`%${String(parsed).replace(/[%_]/g,'')}%`).limit(8);return (data||[]).find(m=>m.is_active!==false&&normalize(m.status)!=='inactive')||null}
function memberName(m){return m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||'Member'}
function ensureUI(){const host=document.getElementById('vccfSpecialEventSession');if(!host||!host.innerHTML)return;if(host.querySelector('#vccfSeConvenience'))return;const bar=host.querySelector('.vccf-se-attbar');if(!bar)return;const select=host.querySelector('#vccfSeMember');
const box=document.createElement('div');box.id='vccfSeConvenience';box.style.cssText='display:grid;gap:10px;margin:12px 0 14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel)';box.innerHTML=`<div style="display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:8px;align-items:center"><input id="vccfSeSearch" class="search" placeholder="Search member by name or member code" autocomplete="off"><button type="button" class="btn secondary" id="vccfSeScanBtn">📷 Scan QR</button></div><div id="vccfSeSearchResults" style="display:grid;gap:6px"></div><div id="vccfSeScannerWrap" style="display:none"><div id="vccfSeScanner" style="width:100%;max-width:520px;margin:0 auto;border-radius:14px;overflow:hidden;background:#000"></div><button type="button" class="btn secondary" id="vccfSeStopScan" style="width:100%;margin-top:8px">Close Scanner</button></div>`;
bar.insertAdjacentElement('beforebegin',box);
const search=box.querySelector('#vccfSeSearch'),results=box.querySelector('#vccfSeSearchResults');
let timer=0;
search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{const q=search.value.trim();results.innerHTML='';if(q.length<2)return;const {data}=await client.from('members').select('id,display_name,first_name,last_name,member_code,is_active,status').or(`display_name.ilike.%${q.replace(/[%_]/g,'')}%,member_code.ilike.%${q.replace(/[%_]/g,'')}%`).limit(8);(data||[]).filter(m=>m.is_active!==false&&normalize(m.status)!=='inactive').forEach(m=>{const b=document.createElement('button');b.type='button';b.className='btn secondary';b.style.cssText='text-align:left;display:flex;justify-content:space-between;gap:10px;align-items:center;width:100%';b.innerHTML=`<span>${esc(memberName(m))}</span><span style="color:var(--muted);font-size:.78rem">${esc(m.member_code||'')}</span>`;b.onclick=async()=>{const ev=findEventId();if(await checkIn(ev,m.id,'search')){search.value='';results.innerHTML='';select.value=m.id;host.querySelector('#vccfSeRefresh')?.click()}};results.appendChild(b)})},180)});
box.querySelector('#vccfSeScanBtn').onclick=()=>startScanner(box);
box.querySelector('#vccfSeStopScan').onclick=()=>stopScanner(box);
}
async function startScanner(box){const eventId=findEventId();if(!eventId){toast('Open a special event attendance session first.');return}if(!window.Html5Qrcode){toast('QR scanner is still loading. Please try again.');return}stopScanner(box);box.querySelector('#vccfSeScannerWrap').style.display='block';scanner=new Html5Qrcode('vccfSeScanner');try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},async text=>{const member=await lookupMember(text);if(!member){toast('QR code does not match a member.');return}const ok=await checkIn(eventId,member.id,'qr');if(ok){await stopScanner(box);document.getElementById('vccfSeRefresh')?.click()}})}catch(e){console.error(e);toast('Unable to start the camera. Check camera permission and try again.');stopScanner(box)}}
async function stopScanner(box){if(scanner){try{await scanner.stop()}catch{}try{await scanner.clear()}catch{}scanner=null}if(box?.querySelector('#vccfSeScannerWrap'))box.querySelector('#vccfSeScannerWrap').style.display='none'}
const obs=new MutationObserver(()=>{const host=document.getElementById('vccfSpecialEventSession');if(host?.innerHTML){ensureUI();const open=host.querySelector('#vccfSeRefresh');if(open&&!open.dataset.eventCapturePatched){open.dataset.eventCapturePatched='1';const original=open.onclick;open.onclick=async()=>{await stopScanner(document.getElementById('vccfSeConvenience'));if(typeof original==='function')await original()}}}});
function captureEventClicks(){document.addEventListener('click',e=>{const b=e.target.closest?.('[data-se-open]');if(b){currentEventId=b.dataset.seOpen;setTimeout(ensureUI,250)}},{capture:true});}
function boot(){captureEventClicks();obs.observe(document.body,{subtree:true,childList:true});setTimeout(ensureUI,700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

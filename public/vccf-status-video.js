(()=>{
'use strict';
if(window.__VCCF_SAFE_DASHBOARD_VIDEO_V1__)return;
window.__VCCF_SAFE_DASHBOARD_VIDEO_V1__=true;
const sb=window.supabase;
const supa=sb?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!supa)return;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const roleName=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfSafeVideoToast);window.__vccfSafeVideoToast=setTimeout(()=>x.classList.remove('show'),2600)}};
function youtubeId(raw){if(!raw)return '';const s=String(raw).trim();if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;try{const u=new URL(s);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];if(u.searchParams.get('v'))return u.searchParams.get('v');const m=u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);if(m)return m[1]}catch{}return ''}
async function profile(){const {data:{user}}=await supa.auth.getUser();if(!user)return null;const {data}=await supa.from('profiles').select('role').eq('user_id',user.id).maybeSingle();return data?{...data,user_id:user.id}:null}
async function renderVideo(){
  const dashboard=document.getElementById('dashboard');
  if(!dashboard)return;
  let panel=document.getElementById('vccfVideoPanel');
  if(!panel){panel=document.createElement('div');panel.id='vccfVideoPanel';panel.className='panel';panel.style.marginTop='16px';dashboard.appendChild(panel)}
  const {data}=await supa.from('site_settings').select('value').eq('key','dashboard_youtube_url').maybeSingle();
  const url=data?.value||'';const id=youtubeId(url);const p=await profile();
  panel.innerHTML=`<div class="toolbar" style="margin-bottom:10px"><div><h3 style="margin:0">VCCF Video</h3><p style="color:var(--muted);margin:4px 0 0">Featured YouTube video for the VCCF Connect dashboard.</p></div>${roleName(p?.role)==='admin'?'<button class="btn" id="editDashboardVideo">Edit video</button>':''}</div>`+(id?`<div style="position:relative;width:100%;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#111"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="VCCF YouTube video" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" allowfullscreen></iframe></div>`:'<div style="padding:30px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px">No video has been added yet.</div>');
  document.getElementById('editDashboardVideo')?.addEventListener('click',async()=>{
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody'),title=document.getElementById('modalTitle');if(!modal||!body)return;
    title.textContent='Dashboard YouTube Video';
    body.innerHTML=`<div class="field"><label for="dashboardYoutubeInput">YouTube link</label><textarea id="dashboardYoutubeInput" rows="3" placeholder="Paste the YouTube link here"></textarea></div><div style="display:flex;gap:8px"><button class="btn" id="saveDashboardVideo">Save video</button><button class="btn danger" id="removeDashboardVideo">Remove</button></div>`;
    modal.classList.add('open');
    const input=document.getElementById('dashboardYoutubeInput');input.value=url;setTimeout(()=>{input.focus();input.select()},50);
    document.getElementById('saveDashboardVideo').onclick=async()=>{const value=input.value.trim();if(value&&!youtubeId(value))return toast('Please enter a valid YouTube link.');const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error)return toast(r.error.message);modal.classList.remove('open');await renderVideo();toast(value?'Video updated.':'Video removed.')};
    document.getElementById('removeDashboardVideo').onclick=async()=>{const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value:'',updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error)return toast(r.error.message);modal.classList.remove('open');await renderVideo();toast('Video removed.')};
  });
}
function run(){if(!document.getElementById('app')?.classList.contains('active'))return;const dashboard=document.getElementById('dashboard');if(!dashboard?.classList.contains('active'))return;renderVideo().catch(()=>{})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,900),{once:true});else setTimeout(run,900);
window.addEventListener('vccf-app-ready',()=>setTimeout(run,300));
})();

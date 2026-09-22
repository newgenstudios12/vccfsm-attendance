(()=>{
'use strict';
if(window.__VCCF_GUEST_PAGE_ADMIN__)return;
window.__VCCF_GUEST_PAGE_ADMIN__=true;

const V=()=>window.VCCF;
const state=()=>V()?.getState?.()||{};
const sb=()=>V()?.sb;
const isAdmin=()=>String(state().profile?.role||'').toLowerCase()==='admin';
const attr=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=[
  {id:'home',label:'Hero / Top Banner',hint:'Main welcome banner at the top of the guest page.',defaultUrl:'/Churchfront_login.png?v=20260903-2'},
  {id:'activity',label:'What’s Happening',hint:'Background behind the public information and announcements section.',defaultUrl:'/vccf-whats-happening-bg.webp?v=20260907-2'},
  {id:'services',label:'Church Services',hint:'Background for the Church Services section.'},
  {id:'leadership',label:'Leadership',hint:'Background for the Leadership section.'},
  {id:'sermons',label:'Sermons',hint:'Background for the Sermons section.'},
  {id:'events',label:'Events',hint:'Background for the Events section.'},
  {id:'gallery',label:'Gallery',hint:'Background for the Gallery section.'},
  {id:'social',label:'Social Media',hint:'Background for the social media section.'},
  {id:'about',label:'About',hint:'Background for the About section.'}
];
let settings={};
let observer=null;
let loading=false;

const urlKey=id=>'guest_page_'+id+'_image_url';
const pathKey=id=>'guest_page_'+id+'_storage_path';

function styles(){
  if(document.getElementById('vccfGuestPageAdminStyles'))return;
  const s=document.createElement('style');
  s.id='vccfGuestPageAdminStyles';
  s.textContent='.vccf-guest-appearance-panel{margin-top:16px}.vccf-guest-appearance-actions{display:flex;gap:8px;flex-wrap:wrap}.vccf-gpa-modal{position:fixed;inset:0;z-index:10070;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.62)}.vccf-gpa-card{width:min(1040px,100%);max-height:94vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:20px}.vccf-gpa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.vccf-gpa-head h3{margin:0}.vccf-gpa-head p{margin:5px 0 0;color:var(--muted);font-size:.8rem;line-height:1.5}.vccf-gpa-close{border:0;background:transparent;color:var(--muted);font-size:1.5rem;cursor:pointer}.vccf-gpa-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.vccf-gpa-item{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--card)}.vccf-gpa-preview{aspect-ratio:16/9;background:#eef0f3 center/cover no-repeat;display:grid;place-items:center;color:var(--muted);font-size:.75rem;font-weight:800}.vccf-gpa-copy{padding:13px}.vccf-gpa-copy h4{margin:0 0 5px;font-size:.9rem}.vccf-gpa-copy p{min-height:36px;margin:0 0 10px;color:var(--muted);font-size:.72rem;line-height:1.45}.vccf-gpa-state{display:block;margin-bottom:10px;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#667085}.vccf-gpa-state.custom{color:#167647}.vccf-gpa-actions{display:flex;gap:7px;flex-wrap:wrap}.vccf-gpa-actions .cms-small{flex:1}.vccf-gpa-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}.vccf-gpa-msg{font-size:.76rem;color:var(--muted)}.vccf-gpa-danger{color:#b42318!important}.vccf-gpa-busy{opacity:.65;pointer-events:none}@media(max-width:880px){.vccf-gpa-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.vccf-gpa-modal{padding:8px}.vccf-gpa-card{padding:15px;border-radius:16px}.vccf-gpa-grid{grid-template-columns:1fr}.vccf-gpa-footer{align-items:stretch;flex-direction:column}.vccf-gpa-footer .btn{width:100%}}';
  document.head.appendChild(s);
}

async function loadSettings(){
  if(!isAdmin()||!sb()||loading)return;
  loading=true;
  try{
    const result=await sb().from('site_settings').select('key,value').like('key','guest_page_%');
    if(result.error)throw result.error;
    settings=Object.fromEntries((result.data||[]).map(row=>[row.key,row.value]));
  }finally{loading=false}
}

function preview(section){
  const custom=settings[urlKey(section.id)];
  const shown=custom||section.defaultUrl||'';
  return shown
    ? '<div class="vccf-gpa-preview" style="background-image:url('+attr(JSON.stringify(shown))+')"></div>'
    : '<div class="vccf-gpa-preview">Default section style</div>';
}

function managerHtml(){
  return '<div class="vccf-gpa-card"><div class="vccf-gpa-head"><div><h3>Guest Page Appearance</h3><p>Change the image for each public guest-page section. Images are public, but only Admin accounts can change these settings.</p></div><button class="vccf-gpa-close" type="button" aria-label="Close">×</button></div><div class="vccf-gpa-grid">'+sections.map(section=>{
    const custom=Boolean(settings[urlKey(section.id)]);
    return '<article class="vccf-gpa-item" data-gpa-card="'+attr(section.id)+'">'+preview(section)+'<div class="vccf-gpa-copy"><h4>'+attr(section.label)+'</h4><p>'+attr(section.hint)+'</p><span class="vccf-gpa-state '+(custom?'custom':'')+'">'+(custom?'Custom image active':'Using default')+'</span><div class="vccf-gpa-actions"><button class="cms-small" type="button" data-gpa-change="'+attr(section.id)+'">Change image</button><button class="cms-small vccf-gpa-danger" type="button" data-gpa-reset="'+attr(section.id)+'" '+(custom?'':'disabled')+'>Restore default</button></div><input hidden type="file" data-gpa-file="'+attr(section.id)+'" accept="image/png,image/jpeg,image/webp"></div></article>';
  }).join('')+'</div><div class="vccf-gpa-footer"><div id="vccfGpaMsg" class="vccf-gpa-msg">Recommended: landscape image, 1600×900 or larger, JPG/PNG/WebP, up to 8 MB.</div><a class="btn secondary" href="/?public=1" target="_blank" rel="noopener">Preview Guest Page</a></div></div>';
}

function setMessage(text,bad=false){
  const el=document.getElementById('vccfGpaMsg');
  if(!el)return;
  el.textContent=text;
  el.style.color=bad?'#b42318':'';
}

function bindManager(wrap){
  const close=()=>wrap.remove();
  wrap.querySelector('.vccf-gpa-close').onclick=close;
  wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelectorAll('[data-gpa-change]').forEach(button=>{
    button.onclick=()=>wrap.querySelector('[data-gpa-file="'+button.dataset.gpaChange+'"]')?.click();
  });
  wrap.querySelectorAll('[data-gpa-file]').forEach(input=>{
    input.onchange=()=>{const file=input.files?.[0];if(file)upload(input.dataset.gpaFile,file,wrap)};
  });
  wrap.querySelectorAll('[data-gpa-reset]').forEach(button=>{
    button.onclick=()=>restore(button.dataset.gpaReset,wrap);
  });
}

async function openManager(){
  if(!isAdmin())return;
  try{await loadSettings()}catch(error){alert(error.message||'Unable to load guest-page settings.');return}
  document.getElementById('vccfGuestAppearanceModal')?.remove();
  const wrap=document.createElement('div');
  wrap.id='vccfGuestAppearanceModal';
  wrap.className='vccf-gpa-modal';
  wrap.innerHTML=managerHtml();
  document.body.appendChild(wrap);
  bindManager(wrap);
}

async function rerenderManager(wrap){
  await loadSettings();
  if(!document.body.contains(wrap))return;
  wrap.innerHTML=managerHtml();
  bindManager(wrap);
}

function extensionFor(file){
  if(file.type==='image/png')return'png';
  if(file.type==='image/webp')return'webp';
  return'jpg';
}

async function upload(id,file,wrap){
  if(!isAdmin()||!sb())return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMessage('Use a JPG, PNG, or WebP image.',true);return}
  if(file.size>8*1024*1024){setMessage('Image must be 8 MB or smaller.',true);return}
  const card=wrap.querySelector('[data-gpa-card="'+id+'"]');
  card?.classList.add('vccf-gpa-busy');
  setMessage('Uploading '+file.name+'…');
  const oldPath=settings[pathKey(id)]||'';
  let newPath='';
  try{
    newPath='guest-page/'+id+'/'+Date.now()+'-'+(crypto.randomUUID?.()||Math.random().toString(36).slice(2))+'.'+extensionFor(file);
    const up=await sb().storage.from('vccf-gallery').upload(newPath,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
    if(up.error)throw up.error;
    const publicUrl=sb().storage.from('vccf-gallery').getPublicUrl(newPath).data.publicUrl;
    const userId=state().session?.user?.id||null;
    const saved=await sb().from('site_settings').upsert([
      {key:urlKey(id),value:publicUrl,updated_at:new Date().toISOString(),updated_by:userId},
      {key:pathKey(id),value:newPath,updated_at:new Date().toISOString(),updated_by:userId}
    ],{onConflict:'key'});
    if(saved.error)throw saved.error;
    if(oldPath&&oldPath!==newPath){
      const cleanup=await sb().storage.from('vccf-gallery').remove([oldPath]);
      if(cleanup.error)console.warn('Old guest-page image cleanup:',cleanup.error);
    }
    setMessage('Image updated.');
    await rerenderManager(wrap);
  }catch(error){
    if(newPath)await sb().storage.from('vccf-gallery').remove([newPath]).catch(()=>{});
    setMessage(error.message||'Unable to update the image.',true);
  }finally{card?.classList.remove('vccf-gpa-busy')}
}

async function restore(id,wrap){
  if(!isAdmin()||!sb())return;
  const section=sections.find(x=>x.id===id);
  if(!section||!confirm('Restore the default image/style for '+section.label+'?'))return;
  const oldPath=settings[pathKey(id)]||'';
  const card=wrap.querySelector('[data-gpa-card="'+id+'"]');
  card?.classList.add('vccf-gpa-busy');
  try{
    const result=await sb().from('site_settings').delete().in('key',[urlKey(id),pathKey(id)]);
    if(result.error)throw result.error;
    if(oldPath){
      const cleanup=await sb().storage.from('vccf-gallery').remove([oldPath]);
      if(cleanup.error)console.warn('Guest-page image cleanup:',cleanup.error);
    }
    await rerenderManager(wrap);
  }catch(error){setMessage(error.message||'Unable to restore the default.',true)}
  finally{card?.classList.remove('vccf-gpa-busy')}
}

function mountPanel(){
  if(!isAdmin())return;
  styles();
  const content=document.getElementById('cmsContent');
  if(!content||!content.querySelector('.cms-stats'))return;
  if(document.getElementById('vccfGuestAppearancePanel'))return;
  const panel=document.createElement('section');
  panel.id='vccfGuestAppearancePanel';
  panel.className='cms-panel card vccf-guest-appearance-panel';
  panel.innerHTML='<div class="cms-panel-head"><div><h3>Guest Page Appearance</h3><p>Manage the public-page picture for each section without changing the page code.</p></div><div class="vccf-guest-appearance-actions"><a class="btn secondary" href="/?public=1" target="_blank" rel="noopener">Preview Guest Page</a><button id="vccfManageGuestImages" class="btn" type="button">Manage Section Images</button></div></div>';
  content.appendChild(panel);
  document.getElementById('vccfManageGuestImages').onclick=openManager;
}

function observe(){
  observer?.disconnect();
  const content=document.getElementById('cmsContent');
  if(!content)return;
  observer=new MutationObserver(()=>setTimeout(mountPanel,0));
  observer.observe(content,{childList:true,subtree:true});
  mountPanel();
}

function init(){
  if(!isAdmin())return;
  styles();
  observe();
  setTimeout(mountPanel,150);
}

window.addEventListener('vccf-cms-route',()=>setTimeout(mountPanel,80));
window.addEventListener('vccf-app-ready',()=>setTimeout(init,250));
window.addEventListener('vccf-signed-out',()=>observer?.disconnect());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,250),{once:true});else setTimeout(init,250);
})();

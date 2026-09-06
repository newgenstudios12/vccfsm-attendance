(()=>{'use strict';
if(window.__VCCF_PUBLIC_EVENT_POLICY__)return;
window.__VCCF_PUBLIC_EVENT_POLICY__=true;
const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const fmt=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const dateFmt=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});
const client=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let observer=null;
let queued=false;
let galleryObserver=null;
let galleryBusy=false;
let completedAlbums=[];
const isVisibleEvent=(e,now=Date.now())=>{
  if(String(e?.status||'').toLowerCase()!=='scheduled')return false;
  const start=new Date(e.start_at).getTime();
  const end=e.end_at?new Date(e.end_at).getTime():start;
  return Number.isFinite(start)&&(start>=now||end>=now);
};
const fileType=row=>{
  const mime=String(row?.mime_type||'').toLowerCase(),name=String(row?.file_name||'').toLowerCase();
  if(mime.includes('pdf')||name.endsWith('.pdf'))return'PDF';
  if(mime.includes('word')||name.endsWith('.doc')||name.endsWith('.docx'))return'Word';
  if(mime.includes('presentation')||name.endsWith('.ppt')||name.endsWith('.pptx'))return'PowerPoint';
  return'Document';
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
function closeMediaModal(){document.getElementById('publicMediaModal')?.remove()}
function openMediaModal(title,kicker,bodyHtml){
  closeMediaModal();
  const modal=document.createElement('div');
  modal.id='publicMediaModal';
  modal.className='media-modal';
  modal.innerHTML='<div class="media-dialog" role="dialog" aria-modal="true"><div class="media-head"><div><span class="section-kicker">'+esc(kicker)+'</span><h3>'+esc(title)+'</h3></div><button class="media-close" type="button" aria-label="Close">×</button></div><div class="media-body">'+bodyHtml+'</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('.media-close').onclick=closeMediaModal;
  modal.onclick=e=>{if(e.target===modal)closeMediaModal()};
  return modal;
}
function safeName(value){return String(value||'vccf-gallery-photo').replace(/[\\/:*?"<>|]+/g,'-').trim()||'vccf-gallery-photo'}
function galleryDownloadUrl(url,name){if(!url)return'';const join=url.includes('?')?'&':'?';return url.includes('/storage/v1/object/public/')?url+join+'download='+encodeURIComponent(name||'vccf-gallery-photo.jpg'):url}
function downloadPhoto(photo,album){
  const filename=safeName(photo?.caption||album?.title)+'.jpg',url=galleryDownloadUrl(photo?.image_url,filename);
  if(!url)return;
  const link=document.createElement('a');link.href=url;link.download=filename;link.target='_blank';link.rel='noopener';document.body.appendChild(link);link.click();link.remove();
}
function previewCompletedAlbum(album){
  const rows=(album?.photos||[]).filter(p=>p.image_url);
  const body=rows.length?'<div class="gallery-preview-grid">'+rows.map((p,i)=>'<article class="preview-photo"><img src="'+attr(p.image_url)+'" alt="'+attr(p.caption||album.title)+'" loading="lazy"><div><span>'+esc(p.caption||('Photo '+(i+1)))+'</span><button class="media-btn" type="button" data-completed-photo-download="'+attr(p.id)+'">Download</button></div></article>').join('')+'</div>':'<div class="empty">No downloadable photos are available in this album yet.</div>';
  const modal=openMediaModal(album.title,album.event_start_at?dateFmt.format(new Date(album.event_start_at)):'Gallery',body);
  modal.querySelectorAll('[data-completed-photo-download]').forEach(button=>button.onclick=()=>downloadPhoto(rows.find(p=>String(p.id)===String(button.dataset.completedPhotoDownload)),album));
}
function attachGalleryObserver(){
  const grid=document.getElementById('galleryGrid');
  if(!grid)return;
  if(!galleryObserver)galleryObserver=new MutationObserver(()=>{if(!galleryBusy)setTimeout(renderCompletedGallery,0)});
  galleryObserver.disconnect();
  galleryObserver.observe(grid,{childList:true,subtree:false});
}
function renderCompletedGallery(){
  const grid=document.getElementById('galleryGrid');
  if(!grid){return}
  galleryBusy=true;
  galleryObserver?.disconnect();
  grid.querySelectorAll('[data-vccf-completed-event-gallery]').forEach(node=>node.remove());
  if(completedAlbums.length){
    if(grid.children.length===1&&grid.firstElementChild?.classList.contains('empty'))grid.innerHTML='';
    const html=completedAlbums.map(album=>{
      const photos=album.photos||[],cover=photos[0];
      return '<article class="gallery-card card" data-vccf-completed-event-gallery="'+attr(album.event_id)+'"><div class="gallery-image"'+(cover?' style="background-image:url(\''+attr(cover.image_url)+'\')"':'')+'></div><div class="gallery-copy"><span class="tag">Completed Event</span><h3>'+esc(album.title)+'</h3><p>'+esc(album.event_start_at?dateFmt.format(new Date(album.event_start_at)):'Event Gallery')+' · '+photos.length+' photo'+(photos.length===1?'':'s')+'</p><div class="media-actions"><button class="media-btn primary" type="button" data-completed-album-preview="'+attr(album.event_id)+'">Preview</button>'+(cover?'<button class="media-btn" type="button" data-completed-cover-download="'+attr(album.event_id)+'">Download</button>':'')+'</div></div></article>';
    }).join('');
    grid.insertAdjacentHTML('beforeend',html);
    grid.querySelectorAll('[data-completed-album-preview]').forEach(button=>button.onclick=()=>previewCompletedAlbum(completedAlbums.find(a=>String(a.event_id)===String(button.dataset.completedAlbumPreview))));
    grid.querySelectorAll('[data-completed-cover-download]').forEach(button=>button.onclick=()=>{const album=completedAlbums.find(a=>String(a.event_id)===String(button.dataset.completedCoverDownload));downloadPhoto(album?.photos?.[0],album)});
  }
  galleryBusy=false;
  attachGalleryObserver();
}
async function loadCompletedGallery(){
  if(!client)return;
  try{
    const {data,error}=await client.from('church_event_photos').select('id,event_id,image_url,caption,sort_order,created_at,event_title,event_start_at,event_status').eq('event_status','Completed').order('created_at',{ascending:true});
    if(error)throw error;
    const groups=new Map();
    (data||[]).filter(p=>p.image_url).forEach(photo=>{
      const key=String(photo.event_id||'');if(!key)return;
      if(!groups.has(key))groups.set(key,{event_id:key,title:photo.event_title||'Church Event',event_start_at:photo.event_start_at||null,photos:[]});
      groups.get(key).photos.push(photo);
    });
    completedAlbums=[...groups.values()].sort((a,b)=>new Date(b.event_start_at||0)-new Date(a.event_start_at||0));
    renderCompletedGallery();
  }catch(error){console.warn('Public completed-event gallery:',error);attachGalleryObserver()}
}
async function previewPublicSermon(id,button){
  if(!client||!id)return;
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Opening…'}
  try{
    const {data:row,error}=await client.from('vccf_sermons').select('id,title,file_path,file_name,mime_type,sermon_category').eq('id',id).maybeSingle();
    if(error)throw error;
    if(!row?.file_path)throw new Error('This sermon file is unavailable.');
    const signed=await client.storage.from('vccf-sermons').createSignedUrl(row.file_path,900);
    if(signed.error)throw signed.error;
    const url=signed.data.signedUrl,type=fileType(row),modal=openMediaModal(row.title,type,'<div class="empty">Preparing sermon preview…</div>'),body=modal.querySelector('.media-body');
    if(type==='PDF'){
      body.innerHTML='<iframe class="sermon-frame" src="'+attr(url)+'#toolbar=1&navpanes=0" title="'+attr(row.title)+' sermon preview"></iframe>';
    }else if(type==='PowerPoint'||type==='Word'){
      const viewer='https://view.officeapps.live.com/op/embed.aspx?src='+encodeURIComponent(url);
      body.innerHTML='<iframe class="sermon-frame" src="'+attr(viewer)+'" title="'+attr(row.title)+' '+attr(type)+' preview" allowfullscreen></iframe>';
    }else{
      body.innerHTML='<div class="nonpdf"><span class="tag">'+esc(type)+'</span><h3>'+esc(row.file_name||row.title)+'</h3><p>This file type cannot be previewed reliably inside the browser.</p><div class="media-actions" style="justify-content:center"><a class="media-btn primary" href="'+attr(url)+'" target="_blank" rel="noopener">Open file</a></div></div>';
    }
  }catch(error){openMediaModal('Sermon','Preview','<div class="empty">'+esc(error.message||'Unable to preview this sermon.')+'</div>')}
  finally{if(button){button.disabled=false;button.textContent=old}}
}
function installSermonPreview(){
  const intro=document.querySelector('#sermons .section-intro');
  if(intro)intro.textContent='Guests can preview published PDF, Word, and PowerPoint sermon materials directly in VCCF Connect.';
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#sermonsGrid [data-sermon-preview]');
    if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    previewPublicSermon(button.dataset.sermonPreview,button);
  },true);
}
function start(){attachObserver();queuePolicy();attachGalleryObserver();loadCompletedGallery();installSermonPreview()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

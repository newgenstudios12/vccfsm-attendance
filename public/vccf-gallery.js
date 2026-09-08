(() => {
'use strict';
if(window.__VCCF_GALLERY__)return;
window.__VCCF_GALLERY__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const isAdmin=()=>role()==='admin';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const labelDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'long',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'Undated';
let data={albums:[],photos:[],summaries:[],summaryPhotos:[],events:[],eventPhotos:[]};

function allAlbums(){
  const manual=(data.albums||[]).map(a=>({...a,auto:false,album_kind:'manual',photos:(data.photos||[]).filter(p=>p.album_id===a.id).sort((x,y)=>(x.sort_order||0)-(y.sort_order||0))}));
  const summaryAlbums=(data.summaries||[]).map(s=>{
    const photos=(data.summaryPhotos||[]).filter(p=>p.summary_id===s.id).sort((x,y)=>(x.sort_order||0)-(y.sort_order||0));
    const sunday=s.summary_type==='sunday';
    return {...s,id:'summary:'+s.id,summary_id:s.id,auto:true,album_kind:sunday?'sunday_summary':'event_summary',title:sunday?'Sunday Worship · '+labelDate(s.summary_date):(s.title||'Church Event'),album_date:s.summary_date,description:s.notes||'',photos};
  }).filter(a=>a.photos.length);
  const eventAlbums=(data.events||[]).map(e=>{
    const photos=(data.eventPhotos||[]).filter(p=>p.event_id===e.id).sort((x,y)=>(x.sort_order||0)-(y.sort_order||0));
    return {...e,id:'event:'+e.id,event_id:e.id,auto:true,album_kind:'event',title:e.title||'Church Event',album_date:e.start_at?phDay(e.start_at):null,description:e.description||'',photos};
  }).filter(a=>a.photos.length);
  return [...manual,...summaryAlbums,...eventAlbums].sort((a,b)=>String(b.album_date||b.created_at||'').localeCompare(String(a.album_date||a.created_at||'')));
}
async function load(){
  const [albums,photos,summaries,summaryPhotos,events,eventPhotos]=await Promise.all([
    sb().from('gallery_albums').select('*').order('album_date',{ascending:false}).order('created_at',{ascending:false}),
    sb().from('gallery_album_photos').select('*').order('sort_order').order('created_at'),
    sb().from('cms_sunday_event_summaries').select('id,summary_type,title,summary_date,notes,posted_at,workflow_status').eq('workflow_status','posted').order('summary_date',{ascending:false}),
    sb().from('cms_summary_photos').select('id,summary_id,image_url,caption,sort_order,created_at').order('sort_order'),
    sb().from('church_events').select('id,title,description,start_at,status,created_at').order('start_at',{ascending:false}),
    sb().from('church_event_photos').select('id,event_id,image_url,caption,sort_order,created_at').order('sort_order').order('created_at')
  ]);
  const err=albums.error||photos.error||summaries.error||summaryPhotos.error||events.error||eventPhotos.error;if(err)throw err;
  data={albums:albums.data||[],photos:photos.data||[],summaries:summaries.data||[],summaryPhotos:summaryPhotos.data||[],events:events.data||[],eventPhotos:eventPhotos.data||[]};
}
function cover(album){return album.photos?.[0]?.image_url||''}
function downloadUrl(url){
  if(!url)return '#';
  return url.includes('/storage/v1/object/public/')?url+(url.includes('?')?'&':'?')+'download=':url;
}
function ensurePreviewStyles(){
  if(document.getElementById('galleryPreviewStyles'))return;
  const style=document.createElement('style');
  style.id='galleryPreviewStyles';
  style.textContent='.gallery-photo-preview-trigger{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}.gallery-photo-preview-trigger img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.gallery-photo-preview{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.82);backdrop-filter:blur(8px)}.gallery-photo-preview-panel{position:relative;width:min(1100px,96vw);max-height:92vh;display:grid;grid-template-rows:minmax(0,1fr) auto;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:0 24px 80px rgba(0,0,0,.35)}.gallery-photo-preview-image-wrap{display:grid;place-items:center;min-height:240px;overflow:auto;background:#090b10}.gallery-photo-preview-image{display:block;max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain}.gallery-photo-preview-footer{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px}.gallery-photo-preview-copy{min-width:0}.gallery-photo-preview-copy strong,.gallery-photo-preview-copy span{display:block}.gallery-photo-preview-copy strong{font-size:.82rem;color:var(--text)}.gallery-photo-preview-copy span{margin-top:3px;color:var(--muted);font-size:.68rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gallery-photo-preview-actions{display:flex;align-items:center;gap:9px;flex-shrink:0}.gallery-photo-preview-download{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 14px;border-radius:10px;background:var(--brand);color:#fff!important;text-decoration:none!important;font-size:.72rem;font-weight:900;white-space:nowrap}.gallery-photo-preview-close{position:absolute;right:12px;top:12px;z-index:2;width:38px;height:38px;border:0;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font-size:1.2rem;line-height:1;cursor:pointer}.gallery-photo-preview-open{overflow:hidden}@media(max-width:640px){.gallery-photo-preview{padding:10px}.gallery-photo-preview-panel{width:100%;max-height:96vh;border-radius:14px}.gallery-photo-preview-image{max-height:72vh}.gallery-photo-preview-footer{align-items:stretch;flex-direction:column;gap:10px}.gallery-photo-preview-actions,.gallery-photo-preview-download{width:100%}}';
  document.head.appendChild(style);
}
function openPhotoPreview(album,index){
  const photo=album.photos?.[index];if(!photo)return;
  ensurePreviewStyles();
  document.getElementById('galleryPhotoPreview')?.remove();
  const modal=document.createElement('div');
  modal.id='galleryPhotoPreview';
  modal.className='gallery-photo-preview';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Gallery photo preview');
  modal.innerHTML='<div class="gallery-photo-preview-panel"><button class="gallery-photo-preview-close" type="button" data-gallery-preview-close aria-label="Close photo preview">×</button><div class="gallery-photo-preview-image-wrap"><img class="gallery-photo-preview-image" src="'+esc(photo.image_url)+'" alt="'+esc(photo.caption||album.title)+'"></div><div class="gallery-photo-preview-footer"><div class="gallery-photo-preview-copy"><strong>'+esc(photo.caption||'Church photo')+'</strong><span>'+esc(album.title)+'</span></div><div class="gallery-photo-preview-actions"><a class="gallery-photo-preview-download" href="'+esc(downloadUrl(photo.image_url))+'" download target="_blank" rel="noopener">↓ Download</a></div></div></div>';
  document.body.appendChild(modal);
  document.body.classList.add('gallery-photo-preview-open');
  const close=()=>{modal.remove();document.body.classList.remove('gallery-photo-preview-open');document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};
  modal.querySelector('[data-gallery-preview-close]').onclick=close;
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',onKey);
  modal.querySelector('[data-gallery-preview-close]')?.focus();
}
function render(){
  const el=document.getElementById('gallery');if(!el)return;
  const albums=allAlbums();
  el.innerHTML='<section class="gallery-hero card"><div><span class="gallery-kicker">VCCF SANTA MARIA</span><h2>Gallery</h2><p>Photos uploaded to posted Sunday Summaries, Event Summaries, and church Events appear here automatically. Profile and member avatar pictures remain separate.</p></div>'+(isAdmin()?'<button id="newGalleryAlbum" class="btn" type="button">+ New album</button>':'')+'</section><div class="gallery-section-head"><div><b>'+albums.length+' album'+(albums.length===1?'':'s')+'</b><span>Sunday albums are named by worship date; event albums use the event name.</span></div></div><div class="gallery-album-grid">'+(albums.length?albums.map(albumCard).join(''):'<div class="gallery-empty card"><b>No albums yet</b><span>Uploaded Summary or Event photos will automatically create albums here.</span></div>')+'</div>';
  document.getElementById('newGalleryAlbum')?.addEventListener('click',renderCreateAlbum);
  el.querySelectorAll('[data-gallery-album]').forEach(card=>card.onclick=()=>openAlbum(card.dataset.galleryAlbum));
}
function autoBadge(a){
  return a.album_kind==='event'?'Event':a.album_kind==='event_summary'?'Event Summary':a.album_kind==='sunday_summary'?'Sunday Summary':'';
}
function albumCard(a){
  const image=cover(a),count=a.photos?.length||0,badgeText=autoBadge(a);
  return '<button class="gallery-album-card card" type="button" data-gallery-album="'+esc(a.id)+'"><div class="gallery-album-cover">'+(image?'<img src="'+esc(image)+'" alt="'+esc(a.title)+'" loading="lazy">':'<div class="gallery-album-placeholder"><span>VCCF</span></div>')+(badgeText?'<span class="gallery-auto-badge '+esc(a.album_kind)+'">'+esc(badgeText)+'</span>':'')+'</div><div class="gallery-album-copy"><span>'+esc(labelDate(a.album_date))+'</span><h3>'+esc(a.title)+'</h3><p>'+count+' photo'+(count===1?'':'s')+'</p></div></button>';
}
function openAlbum(id){
  const album=allAlbums().find(a=>String(a.id)===String(id));if(!album){render();return}
  const el=document.getElementById('gallery');
  const badgeText=autoBadge(album),detailKicker=album.album_kind==='sunday_summary'?'POSTED SUNDAY SUMMARY':album.album_kind==='event_summary'?'POSTED EVENT SUMMARY':album.album_kind==='event'?'CHURCH EVENT':'CHURCH ALBUM';
  el.innerHTML='<div class="gallery-detail-head"><button id="backGallery" class="back-button" type="button">← Back to gallery</button>'+(album.auto?'<span class="gallery-auto-badge static '+esc(album.album_kind)+'">Automatic '+esc(badgeText)+' album</span>':(isAdmin()?'<div class="gallery-admin-actions"><button id="editGalleryAlbum" class="btn secondary" type="button">Edit album</button><button id="deleteGalleryAlbum" class="btn secondary danger-text" type="button">Delete album</button></div>':''))+'</div><section class="gallery-album-detail card"><div><span class="gallery-kicker">'+esc(detailKicker)+'</span><h2>'+esc(album.title)+'</h2><p>'+esc(album.description||'')+'</p><small>'+esc(labelDate(album.album_date))+' · '+(album.photos?.length||0)+' photo'+((album.photos?.length||0)===1?'':'s')+'</small></div>'+(!album.auto&&isAdmin()?'<label class="gallery-upload-btn">+ Add photos<input id="galleryAlbumUpload" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>':'')+'</section><div id="galleryPhotoGrid" class="gallery-photo-grid">'+photoGrid(album)+'</div><div id="galleryMessage" class="gallery-message"></div>';
  document.getElementById('backGallery').onclick=render;
  document.getElementById('editGalleryAlbum')?.addEventListener('click',()=>renderEditAlbum(album));
  document.getElementById('deleteGalleryAlbum')?.addEventListener('click',()=>deleteAlbum(album));
  const input=document.getElementById('galleryAlbumUpload');if(input)input.onchange=()=>uploadPhotos(album,Array.from(input.files||[]));
  bindPhotoButtons(album);
}
function photoGrid(album){
  if(!album.photos?.length)return '<div class="gallery-empty card"><b>No photos in this album yet</b><span>'+(album.auto?'Photos attached to this Summary or Event will appear here automatically.':'Use Add photos to upload church photos.')+'</span></div>';
  return album.photos.map((p,index)=>'<article class="gallery-photo-card"><button class="gallery-photo-preview-trigger" type="button" data-gallery-photo-preview="'+index+'" aria-label="Preview '+esc(p.caption||album.title)+'"><img src="'+esc(p.image_url)+'" alt="'+esc(p.caption||album.title)+'" loading="lazy"></button><div><span>'+esc(p.caption||'Church photo')+'</span>'+(!album.auto&&isAdmin()?'<button type="button" data-delete-gallery-photo="'+esc(p.id)+'">Remove</button>':'')+'</div></article>').join('');
}
function bindPhotoButtons(album){
  document.querySelectorAll('[data-gallery-photo-preview]').forEach(b=>b.onclick=()=>openPhotoPreview(album,Number(b.dataset.galleryPhotoPreview)));
  document.querySelectorAll('[data-delete-gallery-photo]').forEach(b=>b.onclick=()=>deletePhoto(album,b.dataset.deleteGalleryPhoto));
}
function renderCreateAlbum(){
  if(!isAdmin())return;
  const el=document.getElementById('gallery'),today=phDay(new Date());
  el.innerHTML='<div class="gallery-detail-head"><button id="cancelNewAlbum" class="back-button" type="button">← Back to gallery</button></div><section class="gallery-form-card card"><span class="gallery-kicker">ADMIN</span><h2>Create album</h2><form id="galleryAlbumForm" class="gallery-form"><label>Album title<input name="title" required placeholder="e.g. Family Day 2026"></label><label>Album date<input name="album_date" type="date" value="'+today+'"></label><label>Description<textarea name="description" rows="4" placeholder="Optional album description"></textarea></label><div><button class="btn" type="submit">Create album</button></div><span id="galleryFormMessage" class="gallery-message"></span></form></section>';
  document.getElementById('cancelNewAlbum').onclick=render;
  document.getElementById('galleryAlbumForm').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button'),msg=document.getElementById('galleryFormMessage');
    button.disabled=true;button.textContent='Creating…';
    const result=await sb().from('gallery_albums').insert({title:String(fd.get('title')||'').trim(),album_date:String(fd.get('album_date')||'')||null,description:String(fd.get('description')||'').trim()||null,created_by:state().session?.user?.id||null}).select('*').single();
    button.disabled=false;button.textContent='Create album';
    if(result.error){msg.textContent=result.error.message;return}
    await load();openAlbum(result.data.id);
  };
}
function renderEditAlbum(album){
  if(!isAdmin()||album.auto)return;
  const el=document.getElementById('gallery');
  el.innerHTML='<div class="gallery-detail-head"><button id="cancelEditAlbum" class="back-button" type="button">← Back to album</button></div><section class="gallery-form-card card"><span class="gallery-kicker">ADMIN</span><h2>Edit album</h2><form id="galleryEditAlbumForm" class="gallery-form"><label>Album title<input name="title" required value="'+esc(album.title)+'"></label><label>Album date<input name="album_date" type="date" value="'+esc(album.album_date||'')+'"></label><label>Description<textarea name="description" rows="4">'+esc(album.description||'')+'</textarea></label><div><button class="btn" type="submit">Save album</button></div><span id="galleryFormMessage" class="gallery-message"></span></form></section>';
  document.getElementById('cancelEditAlbum').onclick=()=>openAlbum(album.id);
  document.getElementById('galleryEditAlbumForm').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button'),msg=document.getElementById('galleryFormMessage');
    button.disabled=true;button.textContent='Saving…';
    const result=await sb().from('gallery_albums').update({title:String(fd.get('title')||'').trim(),album_date:String(fd.get('album_date')||'')||null,description:String(fd.get('description')||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',album.id).select('*').single();
    button.disabled=false;button.textContent='Save album';
    if(result.error){msg.textContent=result.error.message;return}
    await load();openAlbum(album.id);
  };
}
function preparePhoto(file){
  return new Promise((resolve,reject)=>{
    if(!file?.type?.startsWith('image/'))return reject(new Error('Only image files can be uploaded.'));
    if(file.size>12*1024*1024)return reject(new Error(file.name+' is larger than 12 MB.'));
    const reader=new FileReader();
    reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Could not prepare '+file.name));ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare '+file.name)),'image/jpeg',.86)};img.onerror=()=>reject(new Error('Could not read '+file.name));img.src=reader.result};
    reader.onerror=()=>reject(new Error('Could not read '+file.name));reader.readAsDataURL(file);
  });
}
async function uploadPhotos(album,files){
  if(!isAdmin()||album.auto||!files.length)return;
  const msg=document.getElementById('galleryMessage');if(msg)msg.textContent='Uploading photos…';
  try{
    const selected=files.filter(f=>f.type.startsWith('image/')).slice(0,20);let order=album.photos?.length||0;
    for(const file of selected){
      const blob=await preparePhoto(file),name=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+'.jpg',path='gallery/'+album.id+'/'+Date.now()+'-'+name;
      const up=await sb().storage.from('vccf-gallery').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});if(up.error)throw up.error;
      const url=sb().storage.from('vccf-gallery').getPublicUrl(path).data.publicUrl;
      const row=await sb().from('gallery_album_photos').insert({album_id:album.id,image_url:url,storage_path:path,caption:file.name.replace(/\.[^.]+$/,''),sort_order:order++,uploaded_by:state().session?.user?.id||null});
      if(row.error){await sb().storage.from('vccf-gallery').remove([path]);throw row.error}
    }
    await load();openAlbum(album.id);const next=document.getElementById('galleryMessage');if(next)next.textContent='Photos added.';
  }catch(error){if(msg)msg.textContent=error.message||'Unable to upload photos.'}
}
async function deletePhoto(album,id){
  if(!isAdmin()||album.auto)return;
  const photo=(data.photos||[]).find(p=>p.id===id);if(!photo||!confirm('Remove this photo from the album?'))return;
  const result=await sb().from('gallery_album_photos').delete().eq('id',id);if(result.error){document.getElementById('galleryMessage').textContent=result.error.message;return}
  if(photo.storage_path)await sb().storage.from('vccf-gallery').remove([photo.storage_path]);
  await load();openAlbum(album.id);
}
async function deleteAlbum(album){
  if(!isAdmin()||album.auto)return;
  if(!confirm('Delete the album "'+album.title+'" and its gallery photos?'))return;
  const paths=(album.photos||[]).map(p=>p.storage_path).filter(Boolean);
  const result=await sb().from('gallery_albums').delete().eq('id',album.id);if(result.error){document.getElementById('galleryMessage').textContent=result.error.message;return}
  if(paths.length)await sb().storage.from('vccf-gallery').remove(paths);
  await load();render();
}
async function mount(){
  const el=document.getElementById('gallery');if(!el)return;
  el.innerHTML='<div class="gallery-loading card">Loading gallery…</div>';
  try{await load();render()}catch(error){console.error('VCCF Gallery',error);el.innerHTML='<div class="notice">Gallery could not be loaded. '+esc(error.message||'Please refresh and try again.')+'</div>'}
}
window.VCCFGallery={mount};
window.addEventListener('vccf-sunday-summary-posted',()=>{if(document.getElementById('gallery')?.classList.contains('active'))mount()});
window.addEventListener('vccf-gallery-source-updated',()=>{if(document.getElementById('gallery')?.classList.contains('active'))mount()});
})();

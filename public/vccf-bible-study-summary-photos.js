(()=>{
'use strict';
if(window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__)return;
window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor','area_leader'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const areaName=id=>(state().areas||[]).find(a=>String(a.id)===String(id))?.name||'Church-wide';
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'long',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'Undated';
let photos=new Map(),timer=0,previewSummaryId='',lightboxState=null,galleryObserver=null,galleryTarget=null,memberGalleryCache=null,memberGalleryLoading=false,memberTimer=0;

function installStyles(){
 if(document.getElementById('vccfBibleStudySummaryPhotosCss'))return;
 const s=document.createElement('style');s.id='vccfBibleStudySummaryPhotosCss';s.textContent=`
.bssg-photo-frame{position:relative;width:100%;min-height:120px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:linear-gradient(135deg,rgba(215,25,32,.055),rgba(255,138,24,.07));display:grid;place-items:center}.bssg-photo-grid{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:4px}.bssg-photo-grid.one{grid-template-columns:1fr}.bssg-photo-item{position:relative;aspect-ratio:4/3;border-radius:9px;overflow:hidden;background:var(--card);min-width:0}.bssg-photo-grid.one .bssg-photo-item{aspect-ratio:16/9}.bssg-photo-item img,.bssg-preview-grid img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}.bssg-photo-item img:hover,.bssg-preview-grid img:hover{filter:brightness(.96)}.bssg-photo-remove-one{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(15,23,42,.78);color:#fff;font:900 16px/1 sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(15,23,42,.2)}.bssg-photo-count{position:absolute;left:7px;bottom:7px;padding:4px 7px;border-radius:999px;background:rgba(15,23,42,.76);color:#fff;font-size:.6rem;font-weight:900}.bssg-photo-empty{display:grid;place-items:center;gap:6px;color:var(--muted);font-size:.68rem;font-weight:800;text-align:center;padding:18px}.bssg-photo-empty svg{width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.72}.bssg-photo-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.bssg-photo-actions button{flex:1 1 120px;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 10px;font:inherit;font-size:.67rem;font-weight:900;cursor:pointer}.bssg-photo-actions button:hover{border-color:var(--brand);color:var(--brand)}.bssg-photo-status{font-size:.63rem;line-height:1.4;color:var(--muted);min-height:.9em}.bssg-photo-status.good{color:#167647}.bssg-photo-status.bad{color:#b42318}.bssg-preview-gallery{border:1px solid var(--line);border-radius:14px;padding:8px;background:var(--card-soft,var(--card));display:grid;gap:8px}.bssg-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bssg-preview-grid.one{grid-template-columns:1fr}.bssg-preview-grid img{aspect-ratio:4/3;border-radius:10px}.bssg-preview-grid.one img{aspect-ratio:16/9;max-height:440px}.bssg-preview-caption{display:block;padding:2px 3px;color:var(--muted);font-size:.65rem;font-weight:800}
.bssg-lightbox{position:fixed;inset:0;z-index:10150;background:rgba(4,9,18,.88);display:none;place-items:center;padding:16px}.bssg-lightbox.open{display:grid}.bssg-lightbox-shell{width:min(1180px,100%);max-height:96vh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px}.bssg-lightbox-top{display:flex;justify-content:space-between;gap:14px;align-items:center;color:#fff}.bssg-lightbox-title{min-width:0}.bssg-lightbox-title strong,.bssg-lightbox-title span{display:block}.bssg-lightbox-title strong{font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bssg-lightbox-title span{margin-top:3px;font-size:.68rem;opacity:.72}.bssg-lightbox-close{width:40px;height:40px;flex:0 0 auto;border:1px solid rgba(255,255,255,.24);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-size:1.15rem;cursor:pointer}.bssg-lightbox-stage{min-height:0;position:relative;display:grid;place-items:center}.bssg-lightbox-stage img{display:block;max-width:100%;max-height:82vh;object-fit:contain;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.36)}.bssg-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:58px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(8,12,22,.64);color:#fff;font-size:2rem;cursor:pointer}.bssg-lightbox-nav.prev{left:8px}.bssg-lightbox-nav.next{right:8px}.bssg-lightbox-caption{color:#fff;text-align:center;font-size:.72rem;line-height:1.45;opacity:.82;min-height:1.2em}
.bssg-member-gallery{margin:18px 0 22px;display:grid;gap:12px}.bssg-member-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-end}.bssg-member-head h3{margin:0 0 4px;font-size:1rem}.bssg-member-head p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.45}.bssg-member-badge{padding:5px 8px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-size:.62rem;font-weight:900;color:var(--muted);white-space:nowrap}.bssg-member-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bssg-member-card{border:1px solid var(--line);border-radius:15px;background:var(--card);overflow:hidden;text-align:left;padding:0;color:var(--text);font:inherit;cursor:pointer;box-shadow:0 8px 22px rgba(15,23,42,.05)}.bssg-member-card:hover{transform:translateY(-1px);border-color:rgba(215,25,32,.35)}.bssg-member-cover{position:relative;aspect-ratio:16/10;background:linear-gradient(135deg,rgba(215,25,32,.06),rgba(255,138,24,.08));overflow:hidden}.bssg-member-cover img{width:100%;height:100%;object-fit:cover;display:block}.bssg-member-count{position:absolute;right:8px;bottom:8px;padding:5px 8px;border-radius:999px;background:rgba(15,23,42,.78);color:#fff;font-size:.62rem;font-weight:900}.bssg-member-copy{padding:11px 12px 13px}.bssg-member-copy span,.bssg-member-copy strong{display:block}.bssg-member-copy span{color:var(--muted);font-size:.63rem;font-weight:800}.bssg-member-copy strong{margin:4px 0 5px;font-size:.82rem;line-height:1.35}.bssg-member-copy em{display:block;color:var(--muted);font-size:.67rem;font-style:normal}.bssg-member-empty{padding:16px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:.72rem;background:var(--card-soft,var(--card))}
@media(max-width:980px){.bssg-member-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.bssg-photo-actions{display:grid;grid-template-columns:1fr}.bssg-preview-grid{grid-template-columns:1fr}.bssg-preview-grid img{aspect-ratio:16/9}.bssg-member-grid{grid-template-columns:1fr}.bssg-member-head{align-items:flex-start;flex-direction:column}.bssg-lightbox{padding:10px}.bssg-lightbox-nav{width:40px;height:52px}.bssg-lightbox-stage img{max-height:78vh}}
`;document.head.appendChild(s)
}

function emptyPhoto(){return '<div class="bssg-photo-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 17 4-4 3 3 2-2 5 5"/></svg><span>No pictures uploaded yet</span></div>'}
function setStatus(card,text,kind=''){const el=card?.querySelector?.('.bssg-photo-status');if(!el)return;el.className='bssg-photo-status '+kind;el.textContent=text||''}
function listFor(summaryId){return photos.get(String(summaryId))||[]}

function ensureLightbox(){
 let overlay=document.getElementById('bssgPhotoLightbox');
 if(overlay)return overlay;
 overlay=document.createElement('div');overlay.id='bssgPhotoLightbox';overlay.className='bssg-lightbox';overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="bssg-lightbox-shell" role="dialog" aria-modal="true" aria-label="Bible Study picture preview"><div class="bssg-lightbox-top"><div class="bssg-lightbox-title"><strong id="bssgLightboxTitle">Bible Study Summary</strong><span id="bssgLightboxCount"></span></div><button id="bssgLightboxClose" class="bssg-lightbox-close" type="button" aria-label="Close preview">✕</button></div><div class="bssg-lightbox-stage"><button id="bssgLightboxPrev" class="bssg-lightbox-nav prev" type="button" aria-label="Previous picture">‹</button><img id="bssgLightboxImage" alt=""><button id="bssgLightboxNext" class="bssg-lightbox-nav next" type="button" aria-label="Next picture">›</button></div><div id="bssgLightboxCaption" class="bssg-lightbox-caption"></div></div>';
 document.body.appendChild(overlay);
 document.getElementById('bssgLightboxClose').onclick=closeLightbox;
 document.getElementById('bssgLightboxPrev').onclick=()=>moveLightbox(-1);
 document.getElementById('bssgLightboxNext').onclick=()=>moveLightbox(1);
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeLightbox()});
 return overlay;
}
function openLightbox(list,index=0,title='Bible Study Summary'){
 const items=(Array.isArray(list)?list:[]).filter(p=>p?.image_url);if(!items.length)return;
 lightboxState={list:items,index:Math.max(0,Math.min(Number(index)||0,items.length-1)),title};
 const overlay=ensureLightbox();overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';updateLightbox();setTimeout(()=>document.getElementById('bssgLightboxClose')?.focus(),0)
}
function updateLightbox(){
 if(!lightboxState)return;const {list,index,title}=lightboxState,photo=list[index];if(!photo)return;
 const img=document.getElementById('bssgLightboxImage');img.src=photo.image_url;img.alt=photo.caption||title||'Bible Study picture';
 document.getElementById('bssgLightboxTitle').textContent=title||'Bible Study Summary';
 document.getElementById('bssgLightboxCount').textContent=(index+1)+' / '+list.length;
 document.getElementById('bssgLightboxCaption').textContent=photo.caption||'Bible Study picture';
 const multi=list.length>1;document.getElementById('bssgLightboxPrev').hidden=!multi;document.getElementById('bssgLightboxNext').hidden=!multi;
}
function moveLightbox(step){if(!lightboxState?.list?.length)return;const n=lightboxState.list.length;lightboxState.index=(lightboxState.index+step+n)%n;updateLightbox()}
function closeLightbox(){const overlay=document.getElementById('bssgPhotoLightbox');if(overlay){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true')}lightboxState=null;document.body.style.overflow=''}
document.addEventListener('keydown',e=>{if(!lightboxState)return;if(e.key==='Escape'){e.preventDefault();closeLightbox()}else if(e.key==='ArrowLeft'){e.preventDefault();moveLightbox(-1)}else if(e.key==='ArrowRight'){e.preventDefault();moveLightbox(1)}});

function bindImages(container,list,title){container?.querySelectorAll?.('img').forEach((img,index)=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Preview picture '+(index+1)+' in full screen');img.onclick=e=>{e.preventDefault();e.stopPropagation();openLightbox(list,index,title)};img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLightbox(list,index,title)}}})}

function renderPhotoFrame(frame,list,summaryId){
 if(!list.length){frame.innerHTML=emptyPhoto();return}
 frame.innerHTML='<div class="bssg-photo-grid '+(list.length===1?'one':'')+'">'+list.map((photo,index)=>'<div class="bssg-photo-item"><img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture '+(index+1)+'" loading="lazy">'+(canManage()?'<button class="bssg-photo-remove-one" type="button" data-remove-photo="'+esc(photo.id)+'" aria-label="Remove picture '+(index+1)+'">×</button>':'')+'</div>').join('')+'</div><span class="bssg-photo-count">'+list.length+' photo'+(list.length===1?'':'s')+'</span>';
 bindImages(frame,list,'Bible Study Summary');
 frame.querySelectorAll('[data-remove-photo]').forEach(button=>{button.onclick=e=>{e.preventDefault();e.stopPropagation();removePhoto(summaryId,String(button.dataset.removePhoto||''),frame.closest('.service-summary-gallery-card'))}})
}

function decorateCard(card,list){
 const id=String(card.dataset.summaryId||'');if(!id)return;
 const body=card.querySelector('.service-summary-gallery-body');if(!body)return;
 const safeList=Array.isArray(list)?list:[];
 let frame=body.querySelector('.bssg-photo-frame');if(!frame){frame=document.createElement('div');frame.className='bssg-photo-frame';body.prepend(frame)}
 renderPhotoFrame(frame,safeList,id);
 let actions=body.querySelector('.bssg-photo-actions');
 if(canManage()){
  if(!actions){actions=document.createElement('div');actions.className='bssg-photo-actions';const open=body.querySelector('.service-summary-gallery-open');actions.innerHTML='<input class="bssg-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><button class="bssg-upload" type="button">Add Pictures</button>';if(open)open.insertAdjacentElement('beforebegin',actions);else body.appendChild(actions);const status=document.createElement('div');status.className='bssg-photo-status';actions.insertAdjacentElement('afterend',status)}
  const upload=actions.querySelector('.bssg-upload'),input=actions.querySelector('.bssg-photo-input');
  upload.textContent=safeList.length?'Add More Pictures':'Upload Pictures';
  upload.onclick=()=>input.click();
  input.onchange=async()=>{const files=[...(input.files||[])];input.value='';if(files.length)await uploadPhotos(id,files,card)};
 }else{actions?.remove();body.querySelector('.bssg-photo-status')?.remove()}
 card.dataset.bssgPhotoReady='1';
}

function prepareImage(file){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))return reject(new Error('Choose JPEG, PNG, or WebP pictures.'));
  if(file.size>12*1024*1024)return reject(new Error((file.name||'A picture')+' is larger than 12 MB.'));
  const reader=new FileReader();
  reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('This browser could not prepare the picture.'));ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare the picture.')),'image/jpeg',.84)};img.onerror=()=>reject(new Error('Could not read '+(file.name||'that picture')+'.'));img.src=reader.result};
  reader.onerror=()=>reject(new Error('Could not read '+(file.name||'that picture')+'.'));reader.readAsDataURL(file)
 })
}

async function updateCount(summaryId){
 const list=listFor(summaryId),now=new Date().toISOString();
 const result=await sb().from('cms_service_summaries').update({photo_count:list.length,updated_at:now}).eq('id',summaryId);
 if(result.error)console.warn('Bible Study summary photo count',result.error)
}

async function uploadPhotos(summaryId,files,card){
 if(!canManage()||!sb()||!files.length)return;
 const upload=card.querySelector('.bssg-upload');if(upload){upload.disabled=true;upload.textContent='Uploading…'}
 const current=[...listFor(summaryId)];let uploaded=0,failed=0,lastError='';
 for(let i=0;i<files.length;i++){
  let newPath='';
  try{
   setStatus(card,'Preparing picture '+(i+1)+' of '+files.length+'…');
   const blob=await prepareImage(files[i]),suffix=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2),path='service-summary/'+summaryId+'/'+Date.now()+'-'+suffix+'.jpg';newPath=path;
   setStatus(card,'Uploading picture '+(i+1)+' of '+files.length+'…');
   const stored=await sb().storage.from('vccf-gallery').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});if(stored.error)throw stored.error;
   const imageUrl=sb().storage.from('vccf-gallery').getPublicUrl(path).data.publicUrl,uid=state().session?.user?.id||null,now=new Date().toISOString();
   const saved=await sb().from('cms_service_summary_photos').insert({summary_id:summaryId,image_url:imageUrl,storage_path:path,uploaded_by:uid,updated_at:now}).select('id,summary_id,image_url,storage_path,caption,created_at,updated_at').single();
   if(saved.error)throw saved.error;
   current.push(saved.data);photos.set(summaryId,current);uploaded++;
  }catch(error){failed++;lastError=error?.message||'Unable to upload a picture.';if(newPath)await sb().storage.from('vccf-gallery').remove([newPath])}
 }
 photos.set(summaryId,current);decorateCard(card,current);await updateCount(summaryId);
 if(uploaded&&failed)setStatus(card,'✓ '+uploaded+' picture'+(uploaded===1?'':'s')+' saved. '+failed+' failed: '+lastError,'bad');
 else if(uploaded)setStatus(card,'✓ '+uploaded+' picture'+(uploaded===1?'':'s')+' added.','good');
 else setStatus(card,lastError||'Unable to upload the selected pictures.','bad');
 if(previewSummaryId===summaryId)decoratePreview();
 memberGalleryCache=null;queueMemberGallery();
 window.dispatchEvent(new CustomEvent('vccf-bible-study-summary-photo-updated',{detail:{summaryId,count:current.length}}));
 if(upload){upload.disabled=false;upload.textContent=current.length?'Add More Pictures':'Upload Pictures'}
}

async function removePhoto(summaryId,photoId,card){
 if(!photoId||!canManage()||!sb()||!card)return;
 const list=listFor(summaryId),photo=list.find(p=>String(p.id)===String(photoId));if(!photo)return;
 if(!confirm('Remove this picture from the Bible Study summary?'))return;
 setStatus(card,'Removing picture…');
 try{
  const deleted=await sb().from('cms_service_summary_photos').delete().eq('id',photoId).eq('summary_id',summaryId);if(deleted.error)throw deleted.error;
  const next=list.filter(p=>String(p.id)!==String(photoId));photos.set(summaryId,next);decorateCard(card,next);await updateCount(summaryId);
  if(photo.storage_path){const stored=await sb().storage.from('vccf-gallery').remove([photo.storage_path]);if(stored.error)console.warn('Bible Study summary picture cleanup',stored.error)}
  setStatus(card,'Picture removed.','good');if(previewSummaryId===summaryId)decoratePreview();
  memberGalleryCache=null;queueMemberGallery();
  window.dispatchEvent(new CustomEvent('vccf-bible-study-summary-photo-updated',{detail:{summaryId,count:next.length}}));
 }catch(error){setStatus(card,error?.message||'Unable to remove the picture.','bad')}
}

async function scanGallery(){
 installStyles();
 const cards=[...document.querySelectorAll('#serviceSummaryHost [data-service-summary-gallery] .service-summary-gallery-card[data-summary-id]')].filter(c=>c.dataset.bssgPhotoReady!=='1');
 if(!cards.length||!sb())return;
 const ids=[...new Set(cards.map(c=>String(c.dataset.summaryId||'')).filter(Boolean))];if(!ids.length)return;
 const result=await sb().from('cms_service_summary_photos').select('id,summary_id,image_url,storage_path,caption,created_at,updated_at').in('summary_id',ids).order('created_at',{ascending:true});
 if(result.error){console.warn('Bible Study summary pictures',result.error);cards.forEach(c=>decorateCard(c,[]));return}
 const grouped=new Map(ids.map(id=>[id,[]]));
 for(const photo of result.data||[]){const id=String(photo.summary_id);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(photo)}
 for(const [id,list] of grouped)photos.set(id,list);
 cards.forEach(card=>decorateCard(card,listFor(String(card.dataset.summaryId||''))));
}

function decoratePreview(){
 const overlay=document.getElementById('serviceSummaryPreviewOverlay');if(!overlay||!previewSummaryId)return;
 overlay.querySelector('.bssg-preview-gallery')?.remove();
 const list=listFor(previewSummaryId);if(!list.length)return;
 const body=overlay.querySelector('.service-summary-preview-body');if(!body)return;
 const box=document.createElement('div');box.className='bssg-preview-gallery';box.innerHTML='<div class="bssg-preview-grid '+(list.length===1?'one':'')+'">'+list.map((photo,index)=>'<img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture '+(index+1)+'">').join('')+'</div><span class="bssg-preview-caption">'+list.length+' picture'+(list.length===1?'':'s')+' attached to this Bible Study submission · Click a picture to enlarge</span>';body.prepend(box);bindImages(box,list,'Bible Study Summary')
}

async function loadMemberGallery(force=false){
 if(memberGalleryCache&&!force)return memberGalleryCache;
 if(memberGalleryLoading)return memberGalleryCache||[];
 if(!sb()||!state().session?.user)return [];
 memberGalleryLoading=true;
 try{
  const result=await sb().rpc('get_member_bible_study_gallery');
  if(result.error)throw result.error;
  memberGalleryCache=result.data||[];
  return memberGalleryCache;
 }catch(error){console.warn('Member Bible Study gallery',error);memberGalleryCache=[];return []}
 finally{memberGalleryLoading=false}
}
function groupMemberRows(rows){
 const map=new Map();
 for(const row of rows||[]){const id=String(row.summary_id||'');if(!id)continue;if(!map.has(id))map.set(id,{id,title:row.summary_title||'Bible Study Summary',date:row.summary_date||'',areaId:row.area_id||'',barangay:row.barangay||'',photos:[]});map.get(id).photos.push({id:row.photo_id,image_url:row.image_url,caption:row.caption||'',created_at:row.photo_created_at})}
 return [...map.values()].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
async function renderMemberGallery(){
 installStyles();
 const gallery=document.getElementById('gallery');if(!gallery||!gallery.querySelector('.gallery-hero'))return;
 if(gallery.querySelector('.bssg-member-gallery'))return;
 const rows=await loadMemberGallery();
 if(!gallery.isConnected||gallery.querySelector('.bssg-member-gallery')||!gallery.querySelector('.gallery-hero'))return;
 const groups=groupMemberRows(rows),section=document.createElement('section');section.className='bssg-member-gallery';
 section.innerHTML='<div class="bssg-member-head"><div><h3>Bible Study Summary Gallery</h3><p>Approved Bible Study pictures are visible to all signed-in members. Tap any album to preview its pictures.</p></div><span class="bssg-member-badge">Members</span></div>'+(groups.length?'<div class="bssg-member-grid">'+groups.map((g,index)=>'<button class="bssg-member-card" type="button" data-bssg-member-album="'+index+'"><div class="bssg-member-cover"><img src="'+esc(g.photos[0]?.image_url||'')+'" alt="'+esc(g.title)+'" loading="lazy"><span class="bssg-member-count">'+g.photos.length+' photo'+(g.photos.length===1?'':'s')+'</span></div><div class="bssg-member-copy"><span>'+esc(fmtDate(g.date))+'</span><strong>'+esc(g.title)+'</strong><em>'+esc(areaName(g.areaId)+(g.barangay?' · '+g.barangay:''))+'</em></div></button>').join('')+'</div>':'<div class="bssg-member-empty">No approved Bible Study pictures are available yet.</div>');
 const anchor=gallery.querySelector('.gallery-album-grid')||gallery.querySelector('.gallery-section-head');
 if(anchor)anchor.insertAdjacentElement(anchor.classList.contains('gallery-album-grid')?'beforebegin':'afterend',section);else gallery.appendChild(section);
 section.querySelectorAll('[data-bssg-member-album]').forEach(button=>{button.onclick=()=>{const g=groups[Number(button.dataset.bssgMemberAlbum)||0];if(g)openLightbox(g.photos,0,g.title)}})
}
function queueMemberGallery(){clearTimeout(memberTimer);memberTimer=setTimeout(()=>void renderMemberGallery(),70)}
function watchMemberGallery(){
 const gallery=document.getElementById('gallery');if(!gallery)return;
 if(galleryTarget===gallery)return;
 galleryObserver?.disconnect();galleryTarget=gallery;galleryObserver=new MutationObserver(()=>queueMemberGallery());galleryObserver.observe(gallery,{childList:true,subtree:true});queueMemberGallery();
}

function queue(){clearTimeout(timer);timer=setTimeout(()=>void scanGallery(),40)}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-preview-service-summary]');if(!b)return;previewSummaryId=String(b.dataset.previewServiceSummary||'');setTimeout(decoratePreview,0)});
window.addEventListener('vccf-service-summary-gallery-rendered',queue);
window.addEventListener('vccf-app-ready',()=>{queue();watchMemberGallery();queueMemberGallery()});
window.addEventListener('vccf-bible-study-summary-photo-updated',()=>{queue();memberGalleryCache=null;document.querySelector('.bssg-member-gallery')?.remove();queueMemberGallery()});
window.addEventListener('vccf-gallery-source-updated',()=>{document.querySelector('.bssg-member-gallery')?.remove();queueMemberGallery()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installStyles();queue();watchMemberGallery();queueMemberGallery();setTimeout(queue,300)},{once:true});else{installStyles();queue();watchMemberGallery();queueMemberGallery();setTimeout(queue,300)}
})();

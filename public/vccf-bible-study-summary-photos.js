(()=>{
'use strict';
if(window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__)return;
window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor','area_leader'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let photos=new Map(),timer=0,previewSummaryId='';

function installStyles(){
 if(document.getElementById('vccfBibleStudySummaryPhotosCss'))return;
 const s=document.createElement('style');s.id='vccfBibleStudySummaryPhotosCss';s.textContent=`
.bssg-photo-frame{position:relative;width:100%;min-height:120px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:linear-gradient(135deg,rgba(215,25,32,.055),rgba(255,138,24,.07));display:grid;place-items:center}.bssg-photo-grid{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:4px}.bssg-photo-grid.one{grid-template-columns:1fr}.bssg-photo-item{position:relative;aspect-ratio:4/3;border-radius:9px;overflow:hidden;background:var(--card);min-width:0}.bssg-photo-grid.one .bssg-photo-item{aspect-ratio:16/9}.bssg-photo-item img{width:100%;height:100%;object-fit:cover;display:block}.bssg-photo-remove-one{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(15,23,42,.78);color:#fff;font:900 16px/1 sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(15,23,42,.2)}.bssg-photo-count{position:absolute;left:7px;bottom:7px;padding:4px 7px;border-radius:999px;background:rgba(15,23,42,.76);color:#fff;font-size:.6rem;font-weight:900}.bssg-photo-empty{display:grid;place-items:center;gap:6px;color:var(--muted);font-size:.68rem;font-weight:800;text-align:center;padding:18px}.bssg-photo-empty svg{width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.72}.bssg-photo-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.bssg-photo-actions button{flex:1 1 120px;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 10px;font:inherit;font-size:.67rem;font-weight:900;cursor:pointer}.bssg-photo-actions button:hover{border-color:var(--brand);color:var(--brand)}.bssg-photo-status{font-size:.63rem;line-height:1.4;color:var(--muted);min-height:.9em}.bssg-photo-status.good{color:#167647}.bssg-photo-status.bad{color:#b42318}.bssg-preview-gallery{border:1px solid var(--line);border-radius:14px;padding:8px;background:var(--card-soft,var(--card));display:grid;gap:8px}.bssg-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bssg-preview-grid.one{grid-template-columns:1fr}.bssg-preview-grid img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}.bssg-preview-grid.one img{aspect-ratio:16/9;max-height:440px}.bssg-preview-caption{display:block;padding:2px 3px;color:var(--muted);font-size:.65rem;font-weight:800}@media(max-width:680px){.bssg-photo-actions{display:grid;grid-template-columns:1fr}.bssg-preview-grid{grid-template-columns:1fr}.bssg-preview-grid img{aspect-ratio:16/9}}
`;document.head.appendChild(s)
}

function emptyPhoto(){return '<div class="bssg-photo-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 17 4-4 3 3 2-2 5 5"/></svg><span>No pictures uploaded yet</span></div>'}
function setStatus(card,text,kind=''){const el=card.querySelector('.bssg-photo-status');if(!el)return;el.className='bssg-photo-status '+kind;el.textContent=text||''}
function listFor(summaryId){return photos.get(String(summaryId))||[]}
function renderPhotoFrame(frame,list,summaryId){
 if(!list.length){frame.innerHTML=emptyPhoto();return}
 frame.innerHTML='<div class="bssg-photo-grid '+(list.length===1?'one':'')+'">'+list.map((photo,index)=>'<div class="bssg-photo-item"><img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture '+(index+1)+'" loading="lazy">'+(canManage()?'<button class="bssg-photo-remove-one" type="button" data-remove-photo="'+esc(photo.id)+'" aria-label="Remove picture '+(index+1)+'">×</button>':'')+'</div>').join('')+'</div><span class="bssg-photo-count">'+list.length+' photo'+(list.length===1?'':'s')+'</span>';
 frame.querySelectorAll('[data-remove-photo]').forEach(button=>{button.onclick=()=>removePhoto(summaryId,String(button.dataset.removePhoto||''),frame.closest('.service-summary-gallery-card'))})
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
 const box=document.createElement('div');box.className='bssg-preview-gallery';box.innerHTML='<div class="bssg-preview-grid '+(list.length===1?'one':'')+'">'+list.map((photo,index)=>'<img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture '+(index+1)+'">').join('')+'</div><span class="bssg-preview-caption">'+list.length+' picture'+(list.length===1?'':'s')+' attached to this Bible Study submission</span>';body.prepend(box)
}

function queue(){clearTimeout(timer);timer=setTimeout(()=>void scanGallery(),40)}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-preview-service-summary]');if(!b)return;previewSummaryId=String(b.dataset.previewServiceSummary||'');setTimeout(decoratePreview,0)});
window.addEventListener('vccf-service-summary-gallery-rendered',queue);
window.addEventListener('vccf-app-ready',queue);
window.addEventListener('vccf-bible-study-summary-photo-updated',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{queue();setTimeout(queue,300)},{once:true});else{queue();setTimeout(queue,300)}
})();

(()=>{
'use strict';
if(window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__)return;
window.__VCCF_BIBLE_STUDY_SUMMARY_PHOTOS__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor','area_leader'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let photos=new Map(),timer=0,observer=null,previewSummaryId='';

function installStyles(){
 if(document.getElementById('vccfBibleStudySummaryPhotosCss'))return;
 const s=document.createElement('style');s.id='vccfBibleStudySummaryPhotosCss';s.textContent=`
.bssg-photo-frame{position:relative;width:100%;aspect-ratio:16/9;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:linear-gradient(135deg,rgba(215,25,32,.055),rgba(255,138,24,.07));display:grid;place-items:center}.bssg-photo-frame img{width:100%;height:100%;object-fit:cover;display:block}.bssg-photo-empty{display:grid;place-items:center;gap:6px;color:var(--muted);font-size:.68rem;font-weight:800;text-align:center;padding:18px}.bssg-photo-empty svg{width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.72}.bssg-photo-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.bssg-photo-actions button{flex:1 1 120px;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 10px;font:inherit;font-size:.67rem;font-weight:900;cursor:pointer}.bssg-photo-actions button:hover{border-color:var(--brand);color:var(--brand)}.bssg-photo-actions .bssg-remove{flex:0 0 auto;color:#b42318}.bssg-photo-status{font-size:.63rem;line-height:1.4;color:var(--muted);min-height:.9em}.bssg-photo-status.good{color:#167647}.bssg-photo-status.bad{color:#b42318}.bssg-preview-photo{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card-soft,var(--card))}.bssg-preview-photo img{display:block;width:100%;max-height:420px;object-fit:cover}.bssg-preview-photo span{display:block;padding:8px 11px;color:var(--muted);font-size:.65rem;font-weight:800}@media(max-width:680px){.bssg-photo-actions{display:grid;grid-template-columns:1fr}.bssg-photo-actions .bssg-remove{width:100%}}
`;document.head.appendChild(s)
}

function emptyPhoto(){return '<div class="bssg-photo-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 17 4-4 3 3 2-2 5 5"/></svg><span>No picture uploaded yet</span></div>'}
function setStatus(card,text,kind=''){const el=card.querySelector('.bssg-photo-status');if(!el)return;el.className='bssg-photo-status '+kind;el.textContent=text||''}
function renderPhotoFrame(frame,photo){frame.innerHTML=photo?.image_url?'<img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture" loading="lazy">':emptyPhoto()}

function decorateCard(card,photo){
 const id=String(card.dataset.summaryId||'');if(!id)return;
 const body=card.querySelector('.service-summary-gallery-body');if(!body)return;
 let frame=body.querySelector('.bssg-photo-frame');if(!frame){frame=document.createElement('div');frame.className='bssg-photo-frame';body.prepend(frame)}
 renderPhotoFrame(frame,photo);
 let actions=body.querySelector('.bssg-photo-actions');
 if(canManage()){
  if(!actions){actions=document.createElement('div');actions.className='bssg-photo-actions';const open=body.querySelector('.service-summary-gallery-open');actions.innerHTML='<input class="bssg-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="bssg-upload" type="button">Upload Picture</button><button class="bssg-remove" type="button">Remove</button>';if(open)open.insertAdjacentElement('beforebegin',actions);else body.appendChild(actions);const status=document.createElement('div');status.className='bssg-photo-status';actions.insertAdjacentElement('afterend',status)}
  const upload=actions.querySelector('.bssg-upload'),input=actions.querySelector('.bssg-photo-input'),remove=actions.querySelector('.bssg-remove');
  upload.textContent=photo?'Replace Picture':'Upload Picture';remove.hidden=!photo;
  upload.onclick=()=>input.click();
  input.onchange=async()=>{const file=input.files?.[0];input.value='';if(file)await uploadPhoto(id,file,card)};
  remove.onclick=()=>removePhoto(id,card);
 }else{actions?.remove();body.querySelector('.bssg-photo-status')?.remove()}
 card.dataset.bssgPhotoReady='1';
}

function prepareImage(file){
 return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))return reject(new Error('Choose a JPEG, PNG, or WebP picture.'));
  if(file.size>12*1024*1024)return reject(new Error('Choose a picture smaller than 12 MB.'));
  const reader=new FileReader();
  reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('This browser could not prepare the picture.'));ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare the picture.')),'image/jpeg',.84)};img.onerror=()=>reject(new Error('Could not read that picture.'));img.src=reader.result};
  reader.onerror=()=>reject(new Error('Could not read that picture.'));reader.readAsDataURL(file)
 })
}

async function uploadPhoto(summaryId,file,card){
 if(!canManage()||!sb())return;
 const upload=card.querySelector('.bssg-upload'),remove=card.querySelector('.bssg-remove'),old=photos.get(summaryId)||null;
 if(upload){upload.disabled=true;upload.textContent='Uploading…'}if(remove)remove.disabled=true;setStatus(card,'Preparing picture…');let newPath='';
 try{
  const blob=await prepareImage(file),suffix=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2),path='service-summary/'+summaryId+'/'+Date.now()+'-'+suffix+'.jpg';newPath=path;
  setStatus(card,'Uploading picture…');
  const stored=await sb().storage.from('vccf-gallery').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});if(stored.error)throw stored.error;
  const imageUrl=sb().storage.from('vccf-gallery').getPublicUrl(path).data.publicUrl,uid=state().session?.user?.id||null,now=new Date().toISOString();
  const saved=await sb().from('cms_service_summary_photos').upsert({summary_id:summaryId,image_url:imageUrl,storage_path:path,uploaded_by:uid,updated_at:now},{onConflict:'summary_id'}).select('summary_id,image_url,storage_path,caption,updated_at').single();
  if(saved.error)throw saved.error;
  const countUpdate=await sb().from('cms_service_summaries').update({photo_count:1,updated_at:now}).eq('id',summaryId);if(countUpdate.error)console.warn('Bible Study summary photo count',countUpdate.error);
  photos.set(summaryId,saved.data);decorateCard(card,saved.data);setStatus(card,'✓ Picture saved with this Bible Study summary.','good');
  if(old?.storage_path&&old.storage_path!==path){const removed=await sb().storage.from('vccf-gallery').remove([old.storage_path]);if(removed.error)console.warn('Old Bible Study summary picture cleanup',removed.error)}
  if(previewSummaryId===summaryId)decoratePreview();
  window.dispatchEvent(new CustomEvent('vccf-bible-study-summary-photo-updated',{detail:{summaryId,imageUrl}}));
 }catch(error){if(newPath)await sb().storage.from('vccf-gallery').remove([newPath]);setStatus(card,error?.message||'Unable to upload the picture.','bad')}
 finally{if(upload){upload.disabled=false;upload.textContent=photos.get(summaryId)?'Replace Picture':'Upload Picture'}if(remove)remove.disabled=false}
}

async function removePhoto(summaryId,card){
 const photo=photos.get(summaryId);if(!photo||!canManage()||!sb())return;
 if(!confirm('Remove the picture from this Bible Study summary?'))return;
 const upload=card.querySelector('.bssg-upload'),remove=card.querySelector('.bssg-remove');if(upload)upload.disabled=true;if(remove){remove.disabled=true;remove.textContent='Removing…'}setStatus(card,'Removing picture…');
 try{
  if(photo.storage_path){const stored=await sb().storage.from('vccf-gallery').remove([photo.storage_path]);if(stored.error)throw stored.error}
  const deleted=await sb().from('cms_service_summary_photos').delete().eq('summary_id',summaryId);if(deleted.error)throw deleted.error;
  const now=new Date().toISOString(),countUpdate=await sb().from('cms_service_summaries').update({photo_count:0,updated_at:now}).eq('id',summaryId);if(countUpdate.error)console.warn('Bible Study summary photo count',countUpdate.error);
  photos.delete(summaryId);decorateCard(card,null);setStatus(card,'Picture removed.','good');if(previewSummaryId===summaryId)decoratePreview();
 }catch(error){setStatus(card,error?.message||'Unable to remove the picture.','bad')}
 finally{if(upload)upload.disabled=false;if(remove){remove.disabled=false;remove.textContent='Remove'}}
}

async function scanGallery(){
 installStyles();
 const cards=[...document.querySelectorAll('#serviceSummaryHost [data-service-summary-gallery] .service-summary-gallery-card[data-summary-id]')].filter(c=>c.dataset.bssgPhotoReady!=='1');
 if(!cards.length||!sb())return;
 const ids=[...new Set(cards.map(c=>String(c.dataset.summaryId||'')).filter(Boolean))];if(!ids.length)return;
 const result=await sb().from('cms_service_summary_photos').select('summary_id,image_url,storage_path,caption,updated_at').in('summary_id',ids);
 if(result.error){console.warn('Bible Study summary pictures',result.error);cards.forEach(c=>{c.dataset.bssgPhotoReady='1';decorateCard(c,null)});return}
 for(const p of result.data||[])photos.set(String(p.summary_id),p);
 cards.forEach(card=>decorateCard(card,photos.get(String(card.dataset.summaryId||''))||null));
}

function decoratePreview(){
 const overlay=document.getElementById('serviceSummaryPreviewOverlay');if(!overlay||!previewSummaryId)return;
 overlay.querySelector('.bssg-preview-photo')?.remove();
 const photo=photos.get(String(previewSummaryId));if(!photo?.image_url)return;
 const body=overlay.querySelector('.service-summary-preview-body');if(!body)return;
 const box=document.createElement('div');box.className='bssg-preview-photo';box.innerHTML='<img src="'+esc(photo.image_url)+'" alt="Bible Study summary picture"><span>Picture attached to this Bible Study submission</span>';body.prepend(box)
}

function queue(){clearTimeout(timer);timer=setTimeout(()=>void scanGallery(),90)}
function watch(){if(observer)return;observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true})}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-preview-service-summary]');if(!b)return;previewSummaryId=String(b.dataset.previewServiceSummary||'');setTimeout(decoratePreview,0)});
window.addEventListener('vccf-app-ready',queue);window.addEventListener('vccf-bible-study-summary-photo-updated',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watch();queue()},{once:true});else{watch();queue()}
})();

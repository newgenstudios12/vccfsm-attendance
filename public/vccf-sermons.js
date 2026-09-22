(() => {
'use strict';
if(window.__VCCF_SERMONS__)return;
window.__VCCF_SERMONS__=true;

let root=null;
let sermons=[];
let serviceMedia=[];
let serviceSessions=[];
let selectedCategory='sunday_sermon';

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const categoryLabel=v=>v==='discipleship_training'?'Discipleship Training Sermon':'Sunday Sermon';
const dateLabel=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'Date not set';
const currentUserId=()=>state().session?.user?.id||null;
const fileType=row=>{
  if(!row?.file_path&&!row?.file_name)return '';
  const mime=String(row?.mime_type||'').toLowerCase(),name=String(row?.file_name||'').toLowerCase();
  if(mime.includes('pdf')||name.endsWith('.pdf'))return 'PDF';
  if(mime.includes('word')||name.endsWith('.doc')||name.endsWith('.docx'))return 'Word';
  if(mime.includes('presentation')||name.endsWith('.ppt')||name.endsWith('.pptx'))return 'PowerPoint';
  return 'Document';
};
const fileSize=n=>{
  const bytes=Number(n)||0;
  if(!bytes)return '';
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
};

const serviceLabel=s=>s?((s.title||'Sunday Service')+' · '+dateLabel(s.service_date)):'';
const linkedService=row=>serviceMedia.find(s=>s.id===row?.service_media_id)||null;
const isSundayDate=v=>{if(!v)return false;return new Date(v+'T12:00:00+08:00').getDay()===0};
const sundayServices=()=>serviceMedia.filter(s=>isSundayDate(s.service_date)).sort((a,b)=>String(b.service_date||'').localeCompare(String(a.service_date||'')));
const sessionForDate=date=>serviceSessions.find(s=>s.service_date===date&&String(s.status||'').toLowerCase()!=='cancelled')||null;
const memberNameById=id=>{const m=(state().members||[]).find(x=>x.id===id);return m?(m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||''):''};
const safeHttps=value=>{try{const u=new URL(String(value||'').trim());return u.protocol==='https:'?u:null}catch{return null}};
const isGoogleDriveUrl=value=>{const u=safeHttps(value);return !!u&&['drive.google.com','docs.google.com'].includes(u.hostname.toLowerCase())};
const isYouTubeUrl=value=>{const u=safeHttps(value);return !!u&&['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname.toLowerCase())};
const isFacebookUrl=value=>{const u=safeHttps(value);return !!u&&(u.hostname.toLowerCase()==='facebook.com'||u.hostname.toLowerCase().endsWith('.facebook.com')||u.hostname.toLowerCase()==='fb.watch')};
const youtubeEmbedUrl=value=>{const u=safeHttps(value);if(!u||!isYouTubeUrl(value))return'';let id='';if(u.hostname.toLowerCase()==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';else{const p=u.pathname.split('/').filter(Boolean);if(['shorts','live','embed'].includes(p[0]))id=p[1]||''}return id?'https://www.youtube.com/embed/'+encodeURIComponent(id):''};
const googleDrivePreviewUrl=value=>{const u=safeHttps(value);if(!u||!isGoogleDriveUrl(value))return'';const p=u.pathname.split('/').filter(Boolean);const d=p.indexOf('d');if(d>=0&&p[d+1]){const prefix=u.hostname.toLowerCase()==='drive.google.com'?'file':(p[0]||'document');return 'https://'+u.hostname+'/'+prefix+'/d/'+encodeURIComponent(p[d+1])+'/preview'}return value};
const facebookEmbedUrl=value=>{const u=safeHttps(value);if(!u||!isFacebookUrl(value))return'';return 'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(u.href)+'&show_text=false&width=1000'};
const facebookShareServiceUrl=value=>{const u=safeHttps(value);if(!u||!isFacebookUrl(value))return'';const path=u.pathname.toLowerCase(),host=u.hostname.replace(/^(www\.|m\.)/,'').toLowerCase();return path.startsWith('/share/')||host==='fb.watch'?u.href:''};
const servicePreviewHtml=service=>{
  if(!service)return'';
  const source=String(service.youtube_url||'').trim(),yt=youtubeEmbedUrl(source),fbShare=facebookShareServiceUrl(source),fb=fbShare?'':facebookEmbedUrl(source);
  const label=service.title||'Sunday Service',date=service.service_date?dateLabel(service.service_date):'';
  const player=yt
    ? '<iframe src="'+attr(yt)+'" title="'+attr(label)+' service video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
    : fb
      ? '<iframe src="'+attr(fb)+'" title="'+attr(label)+' Facebook service video" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>'
      : '<div class="sermon-service-fallback"><strong>Service video</strong><span>'+(fbShare?'Facebook does not allow this share link to play inside the app.':'This service link cannot be embedded in the preview.')+'</span></div>';
  return '<section class="sermon-preview-section sermon-linked-service"><div class="sermon-preview-section-head"><div><span class="sermon-kicker">LINKED SUNDAY SERVICE</span><h4>'+esc(label)+'</h4><p>'+esc(date)+(service.description?' · '+esc(service.description):'')+'</p></div>'+(source?'<a class="btn secondary" href="'+attr(source)+'" target="_blank" rel="noopener noreferrer">Open Service</a>':'')+'</div><div class="sermon-service-frame">'+player+'</div></section>';
};
async function sermonMaterialHtml(row){
  if(!row?.file_path)return '<div class="sermon-nonpdf-preview"><h4>No sermon document attached</h4><p>The linked Sunday Service is available above.</p></div>';
  const url=await signedUrl(row,false),type=fileType(row);
  if(type==='PDF')return '<iframe src="'+attr(url)+'#toolbar=1&navpanes=0" title="'+attr(row.title)+' sermon preview"></iframe>';
  if(type==='PowerPoint'||type==='Word')return '<iframe src="'+attr('https://view.officeapps.live.com/op/embed.aspx?src='+encodeURIComponent(url))+'" title="'+attr(row.title)+' '+attr(type)+' preview" allowfullscreen></iframe>';
  return '<div class="sermon-nonpdf-preview">'+iconFor(row)+'<h4>'+esc(row.file_name||row.title)+'</h4><p>Open or download this sermon resource.</p><div><a class="btn secondary" href="'+attr(url)+'" target="_blank" rel="noopener">Open File</a></div></div>';
}

const hasPreviewSource=row=>!!(row?.file_path||row?.google_drive_url||row?.youtube_url||row?.facebook_url);
const resourceSummary=row=>{const parts=[];if(row?.file_path)parts.push(fileType(row)||'File');if(row?.google_drive_url)parts.push('Google Drive');if(row?.youtube_url)parts.push('YouTube');if(row?.facebook_url)parts.push('Facebook');return parts.join(' · ')||'No resource'};
const externalActionLinks=row=>[
  row?.google_drive_url?'<a class="btn secondary" href="'+attr(row.google_drive_url)+'" target="_blank" rel="noopener noreferrer">Google Drive</a>':'',
  row?.youtube_url?'<a class="btn secondary" href="'+attr(row.youtube_url)+'" target="_blank" rel="noopener noreferrer">YouTube</a>':'',
  row?.facebook_url?'<a class="btn secondary" href="'+attr(row.facebook_url)+'" target="_blank" rel="noopener noreferrer">Facebook</a>':''
].join('');
const serviceOptions=selected=>'<option value="">Not linked</option>'+sundayServices().map(s=>'<option value="'+attr(s.id)+'" '+(s.id===selected?'selected':'')+'>'+esc(serviceLabel(s))+'</option>').join('');

async function signedUrl(row,download=false){
  const client=sb();if(!client||!row?.file_path)throw new Error('Sermon file is unavailable.');
  const options=download?{download:row.file_name||'sermon'}:undefined;
  const result=await client.storage.from('vccf-sermons').createSignedUrl(row.file_path,900,options);
  if(result.error)throw result.error;
  return result.data.signedUrl;
}

function iconFor(row){
  const type=fileType(row);
  if(type==='PDF')return '<span class="sermon-file-icon pdf">PDF</span>';
  if(type==='Word')return '<span class="sermon-file-icon doc">DOC</span>';
  if(type==='PowerPoint')return '<span class="sermon-file-icon ppt">PPT</span>';
  return '<span class="sermon-file-icon">FILE</span>';
}

function filtered(){
  const q=String(document.getElementById('sermonSearch')?.value||'').trim().toLowerCase();
  return sermons.filter(s=>s.sermon_category===selectedCategory&&(!q||[
    s.title,s.description,s.preacher,s.file_name
  ].some(v=>String(v||'').toLowerCase().includes(q))));
}

function statsHtml(){
  const sunday=sermons.filter(s=>s.sermon_category==='sunday_sermon').length;
  const training=sermons.filter(s=>s.sermon_category==='discipleship_training').length;
  return '<div class="sermon-stats">'+
    '<article><span>Sunday Sermons</span><strong>'+sunday+'</strong></article>'+
    '<article><span>Discipleship Training</span><strong>'+training+'</strong></article>'+
    '<article><span>Total Sermons</span><strong>'+sermons.length+'</strong></article>'+
  '</div>';
}

function card(row){
  const service=linkedService(row),meta=[row.preacher?row.preacher:null,row.sermon_date?dateLabel(row.sermon_date):null,service?'Linked to '+serviceLabel(service):null].filter(Boolean).join(' · ');
  const fileNote=row.file_path?('<small>'+esc(row.file_name||'Sermon file')+(row.file_size?' · '+esc(fileSize(row.file_size)):'')+'</small>'):'<small>No uploaded file</small>';
  return '<article class="sermon-card card" data-sermon-card="'+row.id+'">'+
    '<div class="sermon-card-top">'+iconFor(row)+'<span class="sermon-category-pill '+(row.sermon_category==='discipleship_training'?'training':'sunday')+'">'+esc(categoryLabel(row.sermon_category))+'</span></div>'+
    '<div class="sermon-card-copy"><h3>'+esc(row.title)+'</h3><p class="sermon-card-meta">'+esc(meta||'VCCF Santa Maria')+'</p><p class="sermon-card-desc">'+esc(row.description||'Open this sermon to view its available material.')+'</p></div>'+
    '<div class="sermon-card-file"><span>'+esc(resourceSummary(row))+'</span>'+fileNote+'</div>'+
    '<div class="sermon-card-actions">'+(hasPreviewSource(row)?'<button type="button" class="btn secondary sermon-preview-btn" data-sermon-preview="'+row.id+'">Preview</button>':'')+(row.file_path?'<button type="button" class="btn secondary" data-sermon-download="'+row.id+'">Download</button>':'')+externalActionLinks(row)+(canManage()?'<button type="button" class="sermon-more" data-sermon-edit="'+row.id+'">Edit</button><button type="button" class="sermon-more danger-text" data-sermon-delete="'+row.id+'">Delete</button>':'')+'</div>'+
  '</article>';
}

function renderGrid(){
  const grid=document.getElementById('sermonGrid');if(!grid)return;
  const rows=filtered();
  grid.innerHTML=rows.map(card).join('')||'<div class="sermon-empty card"><strong>No '+esc(categoryLabel(selectedCategory).replace(' Sermon',' Sermons'))+' yet</strong><span>'+(canManage()?'Use “Upload Sermon” to add the first sermon in this category.':'Sermons will appear here when they are uploaded.')+'</span></div>';
  grid.querySelectorAll('[data-sermon-preview]').forEach(b=>b.onclick=()=>previewSermon(sermons.find(s=>s.id===b.dataset.sermonPreview)));
  grid.querySelectorAll('[data-sermon-download]').forEach(b=>b.onclick=()=>downloadSermon(sermons.find(s=>s.id===b.dataset.sermonDownload),b));
  grid.querySelectorAll('[data-sermon-edit]').forEach(b=>b.onclick=()=>openForm(sermons.find(s=>s.id===b.dataset.sermonEdit)));
  grid.querySelectorAll('[data-sermon-delete]').forEach(b=>b.onclick=()=>deleteSermon(sermons.find(s=>s.id===b.dataset.sermonDelete)));
  const count=document.getElementById('sermonResultCount');if(count)count.textContent=rows.length+' sermon'+(rows.length===1?'':'s');
}

function render(){
  if(!root)return;
  root.innerHTML='<section class="sermon-hero card"><div><span class="sermon-kicker">WORD & DISCIPLESHIP</span><h2>Sermons</h2><p>Browse Sunday messages and Discipleship Training materials from VCCF Santa Maria.</p></div>'+(canManage()?'<button id="uploadSermon" class="btn" type="button">+ Upload Sermon</button>':'')+'</section>'+
    statsHtml()+
    '<section class="sermon-library"><div class="sermon-tabs" role="tablist"><button type="button" class="'+(selectedCategory==='sunday_sermon'?'active':'')+'" data-sermon-category="sunday_sermon">Sunday Sermons</button><button type="button" class="'+(selectedCategory==='discipleship_training'?'active':'')+'" data-sermon-category="discipleship_training">Discipleship Training Sermons</button></div>'+
    '<div class="sermon-toolbar"><div><span class="sermon-kicker">SERMON LIBRARY</span><h3>'+esc(selectedCategory==='sunday_sermon'?'Sunday Sermons':'Discipleship Training Sermons')+'</h3></div><div class="sermon-search-wrap"><input id="sermonSearch" type="search" placeholder="Search title, preacher, file…"><span id="sermonResultCount"></span></div></div>'+
    '<div id="sermonGrid" class="sermon-grid"></div></section>';
  document.getElementById('uploadSermon')?.addEventListener('click',()=>openForm());
  root.querySelectorAll('[data-sermon-category]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.sermonCategory;render()});
  document.getElementById('sermonSearch').oninput=renderGrid;
  renderGrid();
}

async function previewSermon(row){
  if(!row)return;
  document.getElementById('sermonPreviewModal')?.remove();
  const wrap=document.createElement('div');wrap.id='sermonPreviewModal';wrap.className='sermon-modal';
  const service=linkedService(row),meta=[row.preacher,dateLabel(row.sermon_date),service?'Linked to '+serviceLabel(service):''].filter(Boolean).join(' · ');
  wrap.innerHTML='<div class="sermon-preview-card card"><div class="sermon-modal-head"><div><span class="sermon-kicker">'+esc(categoryLabel(row.sermon_category))+'</span><h3>'+esc(row.title)+'</h3><p>'+esc(meta)+'</p></div><button class="sermon-close" type="button" aria-label="Close">×</button></div><div id="sermonPreviewBody" class="sermon-preview-body"><div class="sermon-loading">Preparing preview…</div></div><div class="sermon-preview-actions"><button class="btn secondary sermon-cancel" type="button">Close</button>'+externalActionLinks(row)+(row.file_path?'<button id="sermonPreviewDownload" class="btn" type="button">Download</button>':'')+'</div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.sermon-close').onclick=close;wrap.querySelector('.sermon-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('#sermonPreviewDownload')?.addEventListener('click',e=>downloadSermon(row,e.currentTarget));
  const body=wrap.querySelector('#sermonPreviewBody');
  try{
    if(service&&row.sermon_category==='sunday_sermon'){
      body.classList.add('with-service');
      const material=await sermonMaterialHtml(row);
      body.innerHTML=servicePreviewHtml(service)+'<section class="sermon-preview-section sermon-material-section"><div class="sermon-preview-section-head"><div><span class="sermon-kicker">SERMON MATERIAL</span><h4>'+esc(row.file_name||row.title)+'</h4><p>'+esc(fileType(row)||'Document')+'</p></div></div><div class="sermon-material-frame">'+material+'</div></section>';
      return;
    }
    const yt=youtubeEmbedUrl(row.youtube_url),drive=googleDrivePreviewUrl(row.google_drive_url),fb=facebookEmbedUrl(row.facebook_url);
    if(yt){
      body.innerHTML='<iframe src="'+attr(yt)+'" title="'+attr(row.title)+' YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    }else if(fb){
      body.innerHTML='<iframe src="'+attr(fb)+'" title="'+attr(row.title)+' Facebook video" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>';
    }else if(drive){
      body.innerHTML='<iframe src="'+attr(drive)+'" title="'+attr(row.title)+' Google Drive preview" allowfullscreen></iframe>';
    }else if(row.file_path){
      body.innerHTML=await sermonMaterialHtml(row);
    }else{
      body.innerHTML='<div class="sermon-nonpdf-preview"><h4>No in-app preview available</h4><p>Use one of the linked resource buttons below.</p></div>';
    }
  }catch(error){body.innerHTML='<div class="sermon-preview-error">'+esc(error.message||'Unable to preview this sermon.')+'</div>'}
}

async function downloadSermon(row,button){
  if(!row)return;
  const old=button?.textContent;if(button){button.disabled=true;button.textContent='Preparing…'}
  try{
    const url=await signedUrl(row,true),link=document.createElement('a');
    link.href=url;link.download=row.file_name||'sermon';link.target='_blank';link.rel='noopener';document.body.appendChild(link);link.click();link.remove();
  }catch(error){alert(error.message||'Unable to download this sermon.')}
  finally{if(button){button.disabled=false;button.textContent=old}}
}

function openForm(row=null){
  if(!canManage())return;
  document.getElementById('sermonFormModal')?.remove();
  const wrap=document.createElement('div');wrap.id='sermonFormModal';wrap.className='sermon-modal';
  wrap.innerHTML='<div class="sermon-form-card card"><div class="sermon-modal-head"><div><span class="sermon-kicker">SERMON MANAGEMENT</span><h3>'+(row?'Edit Sermon':'Upload Sermon')+'</h3><p>Link Sunday Sermons to a Sunday Service, or attach Drive / YouTube / Facebook resources to Discipleship Training.</p></div><button class="sermon-close" type="button" aria-label="Close">×</button></div>'+
    '<form id="sermonForm"><label>Category<select name="sermon_category"><option value="sunday_sermon" '+((row?.sermon_category||selectedCategory)==='sunday_sermon'?'selected':'')+'>Sunday Sermon</option><option value="discipleship_training" '+((row?.sermon_category||selectedCategory)==='discipleship_training'?'selected':'')+'>Discipleship Training Sermon</option></select></label>'+
    '<div data-sunday-link><label>Linked Sunday Service<select name="service_media_id">'+serviceOptions(row?.service_media_id||'')+'</select><span class="sermon-form-help">Links this sermon to the actual Church Service video/replay. When matching service details exist for the same date, the form can also suggest preacher, theme, and scripture.</span></label></div>'+
    '<label>Title<input name="title" required value="'+attr(row?.title||'')+'" placeholder="Sermon title"></label>'+
    '<div class="sermon-form-grid"><label>Preacher / Teacher<input name="preacher" value="'+attr(row?.preacher||'')+'" placeholder="Name"></label><label>Sermon date<input name="sermon_date" type="date" value="'+attr(row?.sermon_date||'')+'"></label></div>'+
    '<label>Description<textarea name="description" rows="4" placeholder="Theme, scripture, or short summary">'+esc(row?.description||'')+'</textarea></label>'+
    '<div data-training-links><div class="sermon-form-grid"><label>Google Drive link<input name="google_drive_url" type="url" value="'+attr(row?.google_drive_url||'')+'" placeholder="https://drive.google.com/..."></label><label>YouTube link<input name="youtube_url" type="url" value="'+attr(row?.youtube_url||'')+'" placeholder="https://youtube.com/watch?v=..."></label></div><label>Facebook video / live link<input name="facebook_url" type="url" value="'+attr(row?.facebook_url||'')+'" placeholder="https://www.facebook.com/..."></label><span class="sermon-form-help">You may use one or more external resources. Publicly accessible links work best for guest preview.</span></div>'+
    '<label>Sermon / training file<input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"><span class="sermon-form-help">'+(row?.file_path?'Leave blank to keep '+esc(row.file_name||'the current file')+'.':'Sunday Sermons require an uploaded file. Discipleship Training can use a file or external links. Maximum 50 MB.')+'</span></label>'+
    '<div class="sermon-form-actions"><button class="btn secondary sermon-cancel" type="button">Cancel</button><button class="btn" type="submit">'+(row?'Save Changes':'Save Sermon')+'</button></div><div id="sermonFormMsg" class="sermon-form-msg"></div></form></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove(),form=wrap.querySelector('form'),category=form.elements.sermon_category,service=form.elements.service_media_id,file=form.elements.file,sundayWrap=wrap.querySelector('[data-sunday-link]'),trainingWrap=wrap.querySelector('[data-training-links]');
  wrap.querySelector('.sermon-close').onclick=close;wrap.querySelector('.sermon-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  const syncMode=()=>{const sunday=category.value==='sunday_sermon';sundayWrap.hidden=!sunday;trainingWrap.hidden=sunday;file.required=sunday&&!row?.file_path};
  const fillFromService=()=>{const s=serviceMedia.find(x=>x.id===service.value);if(!s)return;const session=sessionForDate(s.service_date);if(!form.elements.sermon_date.value)form.elements.sermon_date.value=s.service_date||'';if(!form.elements.title.value.trim())form.elements.title.value=s.title||session?.theme||'Sunday Sermon';if(!form.elements.preacher.value.trim())form.elements.preacher.value=session?.guest_preacher||memberNameById(session?.preacher_member_id)||'';if(!form.elements.description.value.trim())form.elements.description.value=[session?.theme,session?.scripture,s.description].filter(Boolean).join(' · ')};
  category.onchange=()=>{syncMode();if(category.value==='sunday_sermon'&&!service.value){const date=form.elements.sermon_date.value,candidates=sundayServices().filter(s=>s.service_date===date);if(candidates.length===1){service.value=candidates[0].id;fillFromService()}}};
  service.onchange=()=>{const s=serviceMedia.find(x=>x.id===service.value);if(s&&s.service_date)form.elements.sermon_date.value=s.service_date;fillFromService()};
  form.elements.sermon_date.onchange=()=>{if(category.value!=='sunday_sermon'||service.value)return;const candidates=sundayServices().filter(s=>s.service_date===form.elements.sermon_date.value);if(candidates.length===1){service.value=candidates[0].id;fillFromService()}};
  syncMode();
  if(!row&&category.value==='sunday_sermon'&&form.elements.sermon_date.value){form.elements.sermon_date.dispatchEvent(new Event('change'))}
  form.onsubmit=e=>saveSermon(e,row,close);
}

async function saveSermon(event,row,close){
  event.preventDefault();
  const form=event.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]'),msg=form.querySelector('#sermonFormMsg'),file=fd.get('file'),category=String(fd.get('sermon_category')||'sunday_sermon');
  const allowed=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  const drive=String(fd.get('google_drive_url')||'').trim(),youtube=String(fd.get('youtube_url')||'').trim(),facebook=String(fd.get('facebook_url')||'').trim();
  if(file?.name&&file.size>50*1024*1024){msg.textContent='The selected file is larger than 50 MB.';return}
  if(file?.name&&file.type&&!allowed.includes(file.type)){msg.textContent='Upload a PDF, Word, or PowerPoint file.';return}
  if(category==='sunday_sermon'&&!file?.name&&!row?.file_path){msg.textContent='Sunday Sermons require an uploaded sermon file.';return}
  if(category==='discipleship_training'&&!file?.name&&!row?.file_path&&!drive&&!youtube&&!facebook){msg.textContent='Add a training file, Google Drive link, YouTube link, or Facebook link.';return}
  if(drive&&!isGoogleDriveUrl(drive)){msg.textContent='Enter a valid Google Drive or Google Docs link.';return}
  if(youtube&&!isYouTubeUrl(youtube)){msg.textContent='Enter a valid YouTube link.';return}
  if(facebook&&!isFacebookUrl(facebook)){msg.textContent='Enter a valid Facebook video or live link.';return}
  button.disabled=true;button.textContent=row?'Saving…':'Saving…';msg.textContent='';
  let newPath='';
  try{
    const client=sb();
    const payload={
      title:String(fd.get('title')||'').trim(),
      description:String(fd.get('description')||'').trim()||null,
      sermon_category:category,
      preacher:String(fd.get('preacher')||'').trim()||null,
      sermon_date:fd.get('sermon_date')||null,
      service_media_id:category==='sunday_sermon'?(fd.get('service_media_id')||null):null,
      service_session_id:category==='sunday_sermon'?(sessionForDate(fd.get('sermon_date'))?.id||null):null,
      google_drive_url:category==='discipleship_training'?(drive||null):null,
      youtube_url:category==='discipleship_training'?(youtube||null):null,
      facebook_url:category==='discipleship_training'?(facebook||null):null,
      updated_at:new Date().toISOString()
    };
    if(file?.name){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'sermon.pdf';
      newPath=category+'/'+Date.now()+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))+'-'+safe;
      const upload=await client.storage.from('vccf-sermons').upload(newPath,file,{upsert:false,contentType:file.type||undefined});
      if(upload.error)throw upload.error;
      payload.file_path=newPath;payload.file_name=file.name;payload.mime_type=file.type||'application/octet-stream';payload.file_size=file.size;
    }
    let result;
    if(row)result=await client.from('vccf_sermons').update(payload).eq('id',row.id).select('*').single();
    else{payload.uploaded_by=currentUserId();result=await client.from('vccf_sermons').insert(payload).select('*').single()}
    if(result.error)throw result.error;
    if(row&&newPath&&row.file_path&&row.file_path!==newPath)await client.storage.from('vccf-sermons').remove([row.file_path]);
    selectedCategory=result.data.sermon_category;
    close();await refresh();
  }catch(error){
    if(newPath)await sb().storage.from('vccf-sermons').remove([newPath]);
    msg.textContent=error.message||'Unable to save sermon.';
    button.disabled=false;button.textContent=row?'Save Changes':'Save Sermon';
  }
}

async function deleteSermon(row){
  if(!canManage()||!row)return;
  if(!confirm('Delete “'+row.title+'”? Any uploaded sermon file will also be removed.'))return;
  const client=sb(),del=await client.from('vccf_sermons').delete().eq('id',row.id);
  if(del.error){alert(del.error.message);return}
  if(row.file_path){const storage=await client.storage.from('vccf-sermons').remove([row.file_path]);if(storage.error)console.warn('Sermon file cleanup',storage.error)}
  await refresh();
}

async function refresh(){
  if(!root)return;
  root.innerHTML='<div class="sermon-loading card">Loading sermons…</div>';
  const [result,media,sessions]=await Promise.all([
    sb().from('vccf_sermons').select('id,title,description,file_path,file_name,mime_type,file_size,uploaded_by,created_at,sermon_category,preacher,sermon_date,updated_at,service_media_id,service_session_id,google_drive_url,youtube_url,facebook_url').order('sermon_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}),
    sb().from('cms_services').select('id,title,youtube_url,service_date,is_live,description,broadcast_status').order('service_date',{ascending:false}).limit(250),
    sb().from('church_service_sessions').select('id,service_date,title,preacher_member_id,guest_preacher,theme,scripture,status').order('service_date',{ascending:false}).limit(250)
  ]);
  if(result.error){root.innerHTML='<div class="notice">Sermons could not be loaded. '+esc(result.error.message)+'</div>';return}
  sermons=result.data||[];
  if(media.error){console.warn('Church Service links unavailable:',media.error);serviceMedia=[]}else serviceMedia=media.data||[];
  if(sessions.error){console.warn('Service detail suggestions unavailable:',sessions.error);serviceSessions=[]}else serviceSessions=sessions.data||[];
  render();
}
async function openById(id){
  if(!id)return;
  const view=document.getElementById('sermons');
  if(!view?.classList.contains('active'))document.querySelector('[data-route="sermons"]')?.click();
  await refresh();
  const row=sermons.find(s=>String(s.id)===String(id));
  if(!row)return;
  selectedCategory=row.sermon_category;render();previewSermon(row);
}

function mount(container=document.getElementById('sermons')){root=container;if(root)refresh()}
function unmount(){root=null;document.getElementById('sermonPreviewModal')?.remove();document.getElementById('sermonFormModal')?.remove()}
window.VCCFSermons={mount,unmount,refresh,openById};
})();
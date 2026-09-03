(() => {
'use strict';
if(window.__VCCF_SERMONS__)return;
window.__VCCF_SERMONS__=true;

let root=null;
let sermons=[];
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

async function signedUrl(row,download=false){
  const client=sb();if(!client||!row?.file_path)throw new Error('Sermon file is unavailable.');
  const options=download?{download:row.file_name||'sermon'}:undefined;
  const result=await client.storage.from('vccf-sermons').createSignedUrl(row.file_path,300,options);
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
  const meta=[row.preacher?row.preacher:null,row.sermon_date?dateLabel(row.sermon_date):null].filter(Boolean).join(' · ');
  return '<article class="sermon-card card" data-sermon-card="'+row.id+'">'+
    '<div class="sermon-card-top">'+iconFor(row)+'<span class="sermon-category-pill '+(row.sermon_category==='discipleship_training'?'training':'sunday')+'">'+esc(categoryLabel(row.sermon_category))+'</span></div>'+
    '<div class="sermon-card-copy"><h3>'+esc(row.title)+'</h3><p class="sermon-card-meta">'+esc(meta||'VCCF Santa Maria')+'</p><p class="sermon-card-desc">'+esc(row.description||'Open this sermon to read or download the material.')+'</p></div>'+
    '<div class="sermon-card-file"><span>'+esc(fileType(row))+(row.file_size?' · '+esc(fileSize(row.file_size)):'')+'</span><small>'+esc(row.file_name||'Sermon file')+'</small></div>'+
    '<div class="sermon-card-actions"><button type="button" class="btn secondary sermon-preview-btn" data-sermon-preview="'+row.id+'">Preview</button><button type="button" class="btn secondary" data-sermon-download="'+row.id+'">Download</button>'+(canManage()?'<button type="button" class="sermon-more" data-sermon-edit="'+row.id+'">Edit</button><button type="button" class="sermon-more danger-text" data-sermon-delete="'+row.id+'">Delete</button>':'')+'</div>'+
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
  wrap.innerHTML='<div class="sermon-preview-card card"><div class="sermon-modal-head"><div><span class="sermon-kicker">'+esc(categoryLabel(row.sermon_category))+'</span><h3>'+esc(row.title)+'</h3><p>'+esc([row.preacher,dateLabel(row.sermon_date)].filter(Boolean).join(' · '))+'</p></div><button class="sermon-close" type="button" aria-label="Close">×</button></div><div id="sermonPreviewBody" class="sermon-preview-body"><div class="sermon-loading">Preparing preview…</div></div><div class="sermon-preview-actions"><button class="btn secondary sermon-cancel" type="button">Close</button><button id="sermonPreviewDownload" class="btn" type="button">Download</button></div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.sermon-close').onclick=close;wrap.querySelector('.sermon-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('#sermonPreviewDownload').onclick=e=>downloadSermon(row,e.currentTarget);
  const body=wrap.querySelector('#sermonPreviewBody');
  try{
    const url=await signedUrl(row,false);
    if(fileType(row)==='PDF'){
      body.innerHTML='<iframe src="'+attr(url)+'#toolbar=1&navpanes=0" title="'+attr(row.title)+' sermon preview"></iframe>';
    }else{
      body.innerHTML='<div class="sermon-nonpdf-preview">'+iconFor(row)+'<h4>'+esc(row.file_name||row.title)+'</h4><p>This file type may not preview reliably inside a browser. You can open it in a new tab or download it.</p><div><a class="btn secondary" href="'+attr(url)+'" target="_blank" rel="noopener">Open File</a></div></div>';
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
  wrap.innerHTML='<div class="sermon-form-card card"><div class="sermon-modal-head"><div><span class="sermon-kicker">SERMON MANAGEMENT</span><h3>'+(row?'Edit Sermon':'Upload Sermon')+'</h3><p>Organize the sermon under Sunday Sermons or Discipleship Training Sermons.</p></div><button class="sermon-close" type="button" aria-label="Close">×</button></div>'+
    '<form id="sermonForm"><label>Category<select name="sermon_category"><option value="sunday_sermon" '+((row?.sermon_category||selectedCategory)==='sunday_sermon'?'selected':'')+'>Sunday Sermon</option><option value="discipleship_training" '+((row?.sermon_category||selectedCategory)==='discipleship_training'?'selected':'')+'>Discipleship Training Sermon</option></select></label>'+
    '<label>Title<input name="title" required value="'+attr(row?.title||'')+'" placeholder="Sermon title"></label>'+
    '<div class="sermon-form-grid"><label>Preacher / Teacher<input name="preacher" value="'+attr(row?.preacher||'')+'" placeholder="Name"></label><label>Sermon date<input name="sermon_date" type="date" value="'+attr(row?.sermon_date||'')+'"></label></div>'+
    '<label>Description<textarea name="description" rows="4" placeholder="Theme, scripture, or short summary">'+esc(row?.description||'')+'</textarea></label>'+
    '<label>Sermon file<input name="file" type="file" '+(row?'':'required')+' accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"><span class="sermon-form-help">'+(row?'Leave blank to keep '+esc(row.file_name)+'.':'PDF is recommended for the best in-app preview. Maximum 50 MB.')+'</span></label>'+
    '<div class="sermon-form-actions"><button class="btn secondary sermon-cancel" type="button">Cancel</button><button class="btn" type="submit">'+(row?'Save Changes':'Upload Sermon')+'</button></div><div id="sermonFormMsg" class="sermon-form-msg"></div></form></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.sermon-close').onclick=close;wrap.querySelector('.sermon-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('form').onsubmit=e=>saveSermon(e,row,close);
}

async function saveSermon(event,row,close){
  event.preventDefault();
  const form=event.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]'),msg=form.querySelector('#sermonFormMsg'),file=fd.get('file');
  const allowed=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  if(file?.name&&file.size>50*1024*1024){msg.textContent='The selected file is larger than 50 MB.';return}
  if(file?.name&&file.type&&!allowed.includes(file.type)){msg.textContent='Upload a PDF, Word, or PowerPoint file.';return}
  button.disabled=true;button.textContent=row?'Saving…':'Uploading…';msg.textContent='';
  let newPath='';
  try{
    const client=sb();
    const payload={
      title:String(fd.get('title')||'').trim(),
      description:String(fd.get('description')||'').trim()||null,
      sermon_category:fd.get('sermon_category'),
      preacher:String(fd.get('preacher')||'').trim()||null,
      sermon_date:fd.get('sermon_date')||null,
      updated_at:new Date().toISOString()
    };
    if(file?.name){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'sermon.pdf';
      newPath=(fd.get('sermon_category')||'sunday_sermon')+'/'+Date.now()+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))+'-'+safe;
      const upload=await client.storage.from('vccf-sermons').upload(newPath,file,{upsert:false,contentType:file.type||undefined});
      if(upload.error)throw upload.error;
      payload.file_path=newPath;payload.file_name=file.name;payload.mime_type=file.type||'application/octet-stream';payload.file_size=file.size;
    }
    let result;
    if(row){
      result=await client.from('vccf_sermons').update(payload).eq('id',row.id).select('*').single();
    }else{
      payload.uploaded_by=currentUserId();
      result=await client.from('vccf_sermons').insert(payload).select('*').single();
    }
    if(result.error)throw result.error;
    if(row&&newPath&&row.file_path&&row.file_path!==newPath)await client.storage.from('vccf-sermons').remove([row.file_path]);
    selectedCategory=result.data.sermon_category;
    close();await refresh();
  }catch(error){
    if(newPath)await sb().storage.from('vccf-sermons').remove([newPath]);
    msg.textContent=error.message||'Unable to save sermon.';
    button.disabled=false;button.textContent=row?'Save Changes':'Upload Sermon';
  }
}

async function deleteSermon(row){
  if(!canManage()||!row)return;
  if(!confirm('Delete “'+row.title+'”? The sermon file will also be removed.'))return;
  const client=sb(),del=await client.from('vccf_sermons').delete().eq('id',row.id);
  if(del.error){alert(del.error.message);return}
  if(row.file_path){const storage=await client.storage.from('vccf-sermons').remove([row.file_path]);if(storage.error)console.warn('Sermon file cleanup',storage.error)}
  await refresh();
}

async function refresh(){
  if(!root)return;
  root.innerHTML='<div class="sermon-loading card">Loading sermons…</div>';
  const result=await sb().from('vccf_sermons').select('id,title,description,file_path,file_name,mime_type,file_size,uploaded_by,created_at,sermon_category,preacher,sermon_date,updated_at').order('sermon_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
  if(result.error){root.innerHTML='<div class="notice">Sermons could not be loaded. '+esc(result.error.message)+'</div>';return}
  sermons=result.data||[];render();
}

function mount(container=document.getElementById('sermons')){root=container;if(root)refresh()}
function unmount(){root=null;document.getElementById('sermonPreviewModal')?.remove();document.getElementById('sermonFormModal')?.remove()}
window.VCCFSermons={mount,unmount,refresh};
})();
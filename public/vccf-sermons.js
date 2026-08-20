(() => {
'use strict';
if(window.__VCCF_SERMONS__)return;
window.__VCCF_SERMONS__=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
let sb=null,user=null,profile=null,sermons=[];
const allowed=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
const maxSize=50*1024*1024;
const css=`
#vccf-sermons-view{display:none!important;padding:10px 0 40px}
#vccf-sermons-view.active{display:block!important}
#vccf-sermons-view .sermons-shell{background:transparent;border:0;border-radius:0;padding:0;box-shadow:none}
#vccf-sermons-view .sermons-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
#vccf-sermons-view .sermons-head h2{margin:0;font-size:1.6rem;letter-spacing:-.04em}
#vccf-sermons-view .sermons-head p{margin:5px 0 0;color:var(--muted)}
#vccf-sermons-view .sermon-admin{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:20px;box-shadow:0 8px 24px rgba(16,24,40,.05)}
#vccf-sermons-view .sermon-admin strong{font-size:1rem}
#vccf-sermons-view .sermon-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
#vccf-sermons-view .sermon-form .full{grid-column:1/-1}
#vccf-sermons-view .sermon-form input,#vccf-sermons-view .sermon-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:var(--bg);color:var(--text)}
#vccf-sermons-view .sermon-form textarea{min-height:82px;resize:vertical}
#vccf-sermons-view .sermon-form button{border:0;border-radius:12px;padding:12px 16px;background:var(--brand-gradient);color:#fff;font-weight:850;cursor:pointer}
#vccf-sermons-view .sermon-form button:disabled{opacity:.65;cursor:wait}
#vccf-sermons-view .sermon-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-items:stretch}
#vccf-sermons-view .sermon-card{min-height:250px;display:flex;flex-direction:column;align-items:stretch;gap:0;border:1px solid var(--line);border-radius:18px;padding:0;overflow:hidden;background:var(--panel);box-shadow:0 8px 26px rgba(16,24,40,.06)}
#vccf-sermons-view .sermon-card::before{content:"";height:6px;display:block;background:var(--brand-gradient)}
#vccf-sermons-view .sermon-icon{margin:18px 18px 0;width:54px;height:54px;border-radius:15px;display:grid;place-items:center;background:var(--brand-gradient);color:#fff;font-weight:900;flex:none;box-shadow:0 8px 18px rgba(215,25,32,.16)}
#vccf-sermons-view .sermon-info{padding:14px 18px 16px;min-width:0;flex:1}
#vccf-sermons-view .sermon-info strong{display:block;font-size:1rem;line-height:1.35;white-space:normal;overflow-wrap:anywhere}
#vccf-sermons-view .sermon-info small{display:block;color:var(--muted);margin-top:6px;line-height:1.4;overflow-wrap:anywhere}
#vccf-sermons-view .sermon-actions{display:flex;gap:8px;padding:0 18px 18px}
#vccf-sermons-view .sermon-actions button{flex:1;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:11px;padding:9px 11px;cursor:pointer;font-weight:800}
#vccf-sermons-view .sermon-actions button:hover{border-color:var(--brand-red,#d71920)}
#vccf-sermons-view .sermon-actions button.danger{flex:0 0 auto;color:var(--danger)}
#vccf-sermons-view .sermon-empty{padding:40px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:18px;background:var(--panel);grid-column:1/-1}
@media(max-width:700px){#vccf-sermons-view .sermon-form{grid-template-columns:1fr}#vccf-sermons-view .sermon-form .full{grid-column:auto}#vccf-sermons-view .sermon-list{grid-template-columns:1fr}}
`;
const addCss=()=>{if(document.getElementById('vccf-sermons-style'))return;const s=document.createElement('style');s.id='vccf-sermons-style';s.textContent=css;document.head.appendChild(s)};
const toast=msg=>{const t=document.getElementById('toast');if(t){t.textContent=msg;t.classList.add('show');clearTimeout(window.__vccfSermonToast);window.__vccfSermonToast=setTimeout(()=>t.classList.remove('show'),2800)}else alert(msg)};
const fmtSize=n=>{if(!n)return '';const u=['B','KB','MB','GB'];let i=0,x=n;while(x>=1024&&i<u.length-1){x/=1024;i++}return `${x.toFixed(i?1:0)} ${u[i]}`};
const fmtDate=s=>{try{return new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}catch{return s}};
function addNav(){const nav=document.querySelector('.nav');if(!nav)return;if(!nav.querySelector('[data-view="sermons"]')){const b=document.createElement('button');b.type='button';b.dataset.view='sermons';b.textContent='📖 Sermons';nav.appendChild(b)}}
function ensureView(){let v=document.getElementById('vccf-sermons-view');if(v)return v;v=document.createElement('section');v.id='vccf-sermons-view';v.className='view';v.innerHTML='<div class="sermons-shell"><div class="sermons-head"><div><h2>📖 Sermons</h2><p>Church sermon files and teaching materials.</p></div></div><div id="vccf-sermon-admin"></div><div id="vccf-sermon-list" class="sermon-list"><div class="sermon-empty">Loading sermons…</div></div></div>';const main=document.querySelector('.main')||document.querySelector('main');(main||document.body).appendChild(v);return v}
function hide(){document.getElementById('vccf-sermons-view')?.remove()}
function showView(){const v=ensureView();document.querySelectorAll('.nav [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view==='sermons'));document.querySelectorAll('.view').forEach(x=>{if(x!==v)x.classList.remove('active')});v.classList.add('active');const title=document.getElementById('pageTitle');if(title)title.textContent='Sermons';load()}
function enforceIsolation(){const v=document.getElementById('vccf-sermons-view');if(!v)return;const otherActive=Array.from(document.querySelectorAll('.view.active')).some(x=>x.id!=='vccf-sermons-view');const title=document.getElementById('pageTitle');const sermonNav=document.querySelector('.nav [data-view="sermons"]');const sermonIsSelected=!!(sermonNav&&sermonNav.classList.contains('active'))||(title&&title.textContent.trim()==='Sermons');if(otherActive||!sermonIsSelected)hide()}
async function refreshSession(){const r=await sb.auth.getSession();user=r.data.session?.user||null;if(!user)return;const p=await sb.from('profiles').select('role,display_name').eq('user_id',user.id).maybeSingle();profile=p.data||null}
function renderAdmin(){const el=document.getElementById('vccf-sermon-admin');if(!el)return;if(profile?.role!=='admin'){el.innerHTML='';return}el.innerHTML='<div class="sermon-admin"><strong>Admin: Upload Sermon</strong><div style="color:var(--muted);font-size:.82rem;margin-top:4px">Upload directly into the Sermons page. Accepted: PDF, DOC, DOCX, PPT, PPTX • Maximum 50 MB.</div><form id="vccf-sermon-form" class="sermon-form"><input name="title" placeholder="Sermon title" required><input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" required><textarea class="full" name="description" placeholder="Description (optional)"></textarea><button class="full" type="submit">Upload Sermon</button></form></div>';el.querySelector('form').addEventListener('submit',upload)}
async function load(){if(!sb)sb=client();if(!sb)return;try{await refreshSession();renderAdmin();const r=await sb.from('vccf_sermons').select('*').order('created_at',{ascending:false});if(r.error)throw r.error;sermons=r.data||[];renderList()}catch(e){console.error('[VCCF Sermons]',e);const el=document.getElementById('vccf-sermon-list');if(el)el.innerHTML='<div class="sermon-empty">Unable to load sermons. Please refresh and try again.</div>'}}
function fileKind(mime){return mime?.includes('pdf')?'PDF':mime?.includes('word')?'DOC':mime?.includes('presentation')?'PPT':'FILE'}
function renderList(){const el=document.getElementById('vccf-sermon-list');if(!el)return;if(!sermons.length){el.innerHTML='<div class="sermon-empty">No sermons have been uploaded yet.</div>';return}el.innerHTML=sermons.map(s=>`<article class="sermon-card"><div class="sermon-icon">${fileKind(s.mime_type)}</div><div class="sermon-info"><strong>${esc(s.title)}</strong><small>${esc(s.file_name)} • ${fmtSize(s.file_size)}</small><small>Uploaded ${fmtDate(s.created_at)}</small>${s.description?`<small>${esc(s.description)}</small>`:''}</div><div class="sermon-actions"><button data-open="${s.id}">Download</button>${profile?.role==='admin'?`<button class="danger" data-delete="${s.id}">Delete</button>`:''}</div></article>`).join('');el.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>downloadFile(b.dataset.open)));el.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>removeSermon(b.dataset.delete)))}
async function upload(e){e.preventDefault();const form=e.currentTarget,file=form.file.files[0],title=form.title.value.trim(),description=form.description.value.trim();if(!file||!title)return;if(!allowed.has(file.type)){toast('Unsupported file format. Use PDF, DOC, DOCX, PPT, or PPTX.');return}if(file.size>maxSize){toast('File is larger than 50 MB.');return}const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Uploading…';try{const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_'),path=`${user.id}/${crypto.randomUUID()}-${safe}`;const up=await sb.storage.from('vccf-sermons').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;const ins=await sb.from('vccf_sermons').insert({title,description:description||null,file_path:path,file_name:file.name,mime_type:file.type,file_size:file.size,uploaded_by:user.id});if(ins.error){await sb.storage.from('vccf-sermons').remove([path]);throw ins.error}form.reset();toast('Sermon uploaded successfully.');await load()}catch(err){console.error('[VCCF Sermons upload]',err);toast(err.message||'Upload failed')}finally{btn.disabled=false;btn.textContent='Upload Sermon'}}
async function downloadFile(id){const s=sermons.find(x=>x.id===id);if(!s)return;const r=await sb.storage.from('vccf-sermons').createSignedUrl(s.file_path,600,{download:s.file_name});if(r.error){toast(r.error.message||'Unable to download file.');return}const a=document.createElement('a');a.href=r.data.signedUrl;a.download=s.file_name;document.body.appendChild(a);a.click();a.remove()}
async function removeSermon(id){const s=sermons.find(x=>x.id===id);if(!s||profile?.role!=='admin')return;if(!confirm(`Delete “${s.title}”?`))return;const r=await sb.storage.from('vccf-sermons').remove([s.file_path]);if(r.error){toast(r.error.message||'Unable to delete file.');return}const d=await sb.from('vccf_sermons').delete().eq('id',id);if(d.error){toast(d.error.message||'Unable to delete sermon record.');return}toast('Sermon deleted.');await load()}
function boot(){addCss();addNav();enforceIsolation();document.getElementById('vccf-sermon-upload-modal')?.remove()}
boot();setTimeout(()=>{addNav();enforceIsolation();document.getElementById('vccf-sermon-upload-modal')?.remove()},500);
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-view]');if(!b)return;if(b.dataset.view==='sermons')showView();else enforceIsolation()},{capture:true});
const observer=new MutationObserver(enforceIsolation);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.VCCFSermons={open:showView,refresh:load,getSermon:id=>sermons.find(x=>x.id===id)};
})();

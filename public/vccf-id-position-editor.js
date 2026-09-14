(()=>{
'use strict';
if(window.__VCCF_ID_POSITION_EDITOR__)return;
window.__VCCF_ID_POSITION_EDITOR__=true;

const state=()=>window.VCCF?.getState?.()||{};
const client=()=>window.VCCF?.sb;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DEFAULT_LAYOUT={
  photo:{x:6.31,y:5.33,w:28.72,h:43.33},
  qr:{x:10.54,y:49.875,w:20.26,h:32.021},
  name:{x:42.65,y:23.68,w:55.6,h:10.55},
  area:{x:43.19,y:33.09,w:51.6,h:6.5},
  dob:{x:42.65,y:48.66,w:20.05,h:10},
  number:{x:65.69,y:48.66,w:30.38,h:10},
  phone:{x:42.65,y:60.63,w:20.05,h:10},
  address:{x:65.69,y:60.63,w:30.38,h:18.5}
};
const LABELS={photo:'Profile photo',qr:'QR code',name:'Name',area:'Area',dob:'Date of birth',number:'Member number',phone:'Mobile number',address:'Address'};
const SAMPLE={photo:'PHOTO',qr:'QR',name:'JUAN DELA CRUZ',area:'AREA 1',dob:'JANUARY 1, 1990',number:'VCCF-000123',phone:'0917 123 4567',address:'SANTA MARIA, LAGUNA'};
const SELECTORS={
  photo:'.id-card .id-photo',qr:'.id-card .id-qr',name:'.id-card .id-card-name',area:'.id-card .id-area',
  dob:'.id-card .id-card-dob',number:'.id-card .id-card-number',phone:'.id-card .id-card-phone',address:'.id-card .id-card-address'
};
let settings=null;
let savedLayout=null;
let editorDraft=null;
let selectedKey='name';
let editorDirty=false;
let syncBusy=false;
let ensureQueued=false;
let styleNode=null;
let lastSignature='';

function cloneLayout(layout){return Object.fromEntries(Object.entries(layout).map(([key,value])=>[key,{...value}]))}
function round(value){return Math.round(Number(value)*1000)/1000}
function clamp(value,min,max){return Math.min(max,Math.max(min,Number(value)||0))}
function validRect(value){return value&&['x','y','w','h'].every(key=>Number.isFinite(Number(value[key])))}
function normalizeLayout(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const result=cloneLayout(DEFAULT_LAYOUT);
  let found=false;
  for(const key of Object.keys(DEFAULT_LAYOUT)){
    if(!validRect(value[key]))continue;
    found=true;
    const w=clamp(value[key].w,4,100),h=clamp(value[key].h,4,100);
    result[key]={x:clamp(value[key].x,0,100-w),y:clamp(value[key].y,0,100-h),w,h};
  }
  return found?result:null;
}
function currentLayout(){return savedLayout||DEFAULT_LAYOUT}
function ensureStyleNode(){
  if(styleNode?.isConnected)return styleNode;
  styleNode=document.getElementById('vccf-id-position-layout-style')||document.createElement('style');
  styleNode.id='vccf-id-position-layout-style';
  if(!styleNode.isConnected)document.head.appendChild(styleNode);
  return styleNode;
}
function applySavedLayout(){
  const node=ensureStyleNode();
  if(!savedLayout){node.textContent='';return}
  node.textContent=Object.entries(SELECTORS).map(([key,selector])=>{
    const r=savedLayout[key]||DEFAULT_LAYOUT[key];
    const extras=key==='qr'?'aspect-ratio:auto!important;':(key==='photo'?'':'overflow:hidden!important;');
    return `${selector}{left:${round(r.x)}%!important;top:${round(r.y)}%!important;width:${round(r.w)}%!important;height:${round(r.h)}%!important;max-width:none!important;box-sizing:border-box!important;${extras}}`;
  }).join('\n');
}
function isAdmin(){return String(state().profile?.role||'').toLowerCase()==='admin'}
function isAuthenticated(){return !!state().session?.user?.id}
function signature(row){return JSON.stringify({template_url:row?.template_url||'',updated_at:row?.updated_at||'',layout_json:row?.layout_json||{}})}
async function syncSettings(force=false){
  if(syncBusy||!isAuthenticated()||!client())return;
  syncBusy=true;
  try{
    const {data,error}=await client().from('digital_id_template_settings').select('id,template_url,layout_json,updated_at,updated_by').eq('id','default').maybeSingle();
    if(error)throw error;
    const sig=signature(data);
    if(force||sig!==lastSignature){
      settings=data||null;
      savedLayout=normalizeLayout(data?.layout_json);
      lastSignature=sig;
      applySavedLayout();
      if(!editorDirty)editorDraft=cloneLayout(currentLayout());
      queueEnsureEditor();
    }
  }catch(error){
    console.warn('Digital ID position settings could not be refreshed:',error);
  }finally{syncBusy=false}
}

function ensureEditorStyles(){
  if(document.getElementById('vccf-id-position-editor-styles'))return;
  const style=document.createElement('style');
  style.id='vccf-id-position-editor-styles';
  style.textContent=`
  .id-position-editor{margin-top:20px;padding-top:20px;border-top:1px solid var(--line,#e5e7eb)}
  .id-position-editor-head{display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .id-position-editor-head h3{margin:0 0 5px;font-size:1rem}.id-position-editor-head p{margin:0;color:var(--muted,#626b78);font-size:.86rem;line-height:1.45}
  .id-position-workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(235px,.75fr);gap:18px;align-items:start}
  .id-position-stage{width:100%;max-width:720px;container-type:inline-size}
  .id-position-card{position:relative;width:100%;aspect-ratio:324/205;overflow:hidden;border-radius:8px;background:linear-gradient(rgba(255,255,255,.9),rgba(255,255,255,.9)),url('/Churchfront_login.png') center/cover no-repeat;box-shadow:0 10px 24px rgba(15,23,42,.14);touch-action:none;user-select:none}
  .id-position-template{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none}
  .id-position-art{position:absolute;left:.126%;top:48.66%;width:99.72%;height:124.02%;background:url('/assets/vccf-id-orange-art.png') center/100% 100% no-repeat;opacity:.18;pointer-events:none}
  .id-position-logo{position:absolute;left:77.78%;top:-1.26%;width:16.37%;height:25.88%;object-fit:contain;pointer-events:none}
  .id-position-divider{position:absolute;left:42.65%;top:43.5%;width:50.63%;height:.37cqw;background:#191919;pointer-events:none}
  .id-position-footer{position:absolute;inset:84.57% 0 0;background:linear-gradient(90deg,#850201,#e88929);pointer-events:none}
  .id-position-box{position:absolute;z-index:3;border:1.5px dashed rgba(20,74,160,.78);background:rgba(255,255,255,.72);color:#111;display:flex;align-items:center;padding:.55cqw .75cqw;box-sizing:border-box;overflow:hidden;cursor:grab;touch-action:none;font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:2.3cqw;line-height:1.08;text-transform:uppercase}
  .id-position-box[data-id-editor-key=name]{font-size:4.5cqw;background:rgba(255,255,255,.5)}
  .id-position-box[data-id-editor-key=area]{font-size:3cqw;background:rgba(255,255,255,.5)}
  .id-position-box[data-id-editor-key=photo],.id-position-box[data-id-editor-key=qr]{justify-content:center;background:rgba(241,240,238,.88);font-size:3cqw}
  .id-position-box.is-selected{outline:2px solid #d71920;border-color:#d71920;background:rgba(255,255,255,.88);z-index:5;cursor:grabbing}
  .id-position-handle{position:absolute;right:-1px;bottom:-1px;width:16px;height:16px;border:0;background:#d71920;cursor:nwse-resize;touch-action:none;padding:0;border-radius:3px 0 0 0}
  .id-position-controls{display:grid;gap:12px;padding:14px;border:1px solid var(--line,#e5e7eb);border-radius:12px;background:var(--bg,#f6f7f9)}
  .id-position-controls strong{font-size:.95rem}.id-position-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .id-position-fields label{display:grid;gap:5px;font-size:.76rem;font-weight:800;color:var(--muted,#626b78)}
  .id-position-fields input{width:100%;min-width:0;padding:9px 10px;border:1px solid var(--line,#d1d5db);border-radius:9px;background:var(--card,#fff);color:var(--text,#15171c);font:inherit}
  .id-position-fields input:focus{outline:2px solid rgba(215,25,32,.16);border-color:#d71920}
  .id-position-list{display:flex;gap:6px;flex-wrap:wrap}.id-position-chip{border:1px solid var(--line,#d1d5db);background:var(--card,#fff);color:var(--text,#15171c);padding:7px 9px;border-radius:999px;font-size:.76rem;font-weight:800;cursor:pointer}.id-position-chip.active{border-color:#d71920;color:#d71920;background:rgba(215,25,32,.07)}
  .id-position-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.id-position-actions .btn{flex:1;min-width:150px}
  [data-id-position-feedback]{min-height:21px;margin-top:8px;font-size:.84rem;line-height:1.45}.id-position-error{color:#c0202b}
  @media(max-width:850px){.id-position-workspace{grid-template-columns:1fr}.id-position-stage{max-width:none}}
  @media(max-width:520px){.id-position-actions{display:grid}.id-position-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);
}
function editorBackground(){
  const templateUrl=settings?.template_url||'';
  if(templateUrl)return `<img class="id-position-template" src="${esc(templateUrl)}" alt="Current Digital ID template">`;
  return `<div class="id-position-art" aria-hidden="true"></div><img class="id-position-logo" src="/vccf-logo-black.png" alt=""><div class="id-position-divider" aria-hidden="true"></div><div class="id-position-footer" aria-hidden="true"></div>`;
}
function rectStyle(rect){return `left:${round(rect.x)}%;top:${round(rect.y)}%;width:${round(rect.w)}%;height:${round(rect.h)}%;`}
function editorMarkup(){
  editorDraft=editorDraft||cloneLayout(currentLayout());
  return `<div class="id-position-editor" data-id-position-editor>
    <div class="id-position-editor-head"><div><h3>Visual position editor</h3><p>Drag a field to move it. Drag the red corner to resize it. Positions are stored as percentages, so they stay aligned on phones, tablets, downloads, and printed IDs.</p></div></div>
    <div class="id-position-workspace">
      <div class="id-position-stage"><div class="id-position-card" data-id-editor-card>${editorBackground()}${Object.keys(DEFAULT_LAYOUT).map(key=>`<div class="id-position-box${key===selectedKey?' is-selected':''}" data-id-editor-key="${key}" style="${rectStyle(editorDraft[key])}" role="button" tabindex="0" aria-label="${esc(LABELS[key])}"><span>${esc(SAMPLE[key])}</span><button type="button" class="id-position-handle" data-id-resize-handle aria-label="Resize ${esc(LABELS[key])}"></button></div>`).join('')}</div></div>
      <div class="id-position-controls"><strong data-id-position-selected-label>${esc(LABELS[selectedKey])}</strong><div class="id-position-list">${Object.keys(DEFAULT_LAYOUT).map(key=>`<button type="button" class="id-position-chip${key===selectedKey?' active':''}" data-id-position-select="${key}">${esc(LABELS[key])}</button>`).join('')}</div><div class="id-position-fields">${[['x','Left %'],['y','Top %'],['w','Width %'],['h','Height %']].map(([field,label])=>`<label>${label}<input type="number" step="0.1" min="0" max="100" data-id-position-input="${field}" value="${round(editorDraft[selectedKey][field])}"></label>`).join('')}</div><p class="id-template-help">Tip: choose a field from the chips, then use the number boxes for exact adjustments.</p></div>
    </div>
    <div class="id-position-actions"><button type="button" class="btn" data-save-id-positions>Save positions</button><button type="button" class="btn secondary" data-reset-id-positions>Reset to original positions</button><button type="button" class="btn secondary" data-discard-id-positions>Discard unsaved changes</button></div>
    <div data-id-position-feedback role="status" aria-live="polite"></div>
  </div>`;
}
function queueEnsureEditor(){if(ensureQueued)return;ensureQueued=true;requestAnimationFrame(()=>{ensureQueued=false;ensureEditor()})}
function ensureEditor(){
  ensureEditorStyles();
  if(!isAdmin())return;
  const panel=document.querySelector('.id-template-admin');
  if(!panel||panel.querySelector('[data-id-position-editor]'))return;
  panel.insertAdjacentHTML('beforeend',editorMarkup());
  bindEditor(panel.querySelector('[data-id-position-editor]'));
}
function feedback(editor,text,error=false){const el=editor?.querySelector('[data-id-position-feedback]');if(!el)return;el.textContent=text||'';el.classList.toggle('id-position-error',error)}
function selectField(editor,key){
  if(!DEFAULT_LAYOUT[key])return;
  selectedKey=key;
  editor.querySelectorAll('[data-id-editor-key]').forEach(el=>el.classList.toggle('is-selected',el.dataset.idEditorKey===key));
  editor.querySelectorAll('[data-id-position-select]').forEach(el=>el.classList.toggle('active',el.dataset.idPositionSelect===key));
  const label=editor.querySelector('[data-id-position-selected-label]');if(label)label.textContent=LABELS[key];
  updateInputs(editor);
}
function updateInputs(editor){
  const rect=editorDraft?.[selectedKey];if(!rect)return;
  editor.querySelectorAll('[data-id-position-input]').forEach(input=>{input.value=round(rect[input.dataset.idPositionInput])});
}
function updateBox(editor,key){
  const box=editor.querySelector(`[data-id-editor-key="${key}"]`),rect=editorDraft?.[key];if(!box||!rect)return;
  box.style.cssText=rectStyle(rect);
  if(key===selectedKey)updateInputs(editor);
}
function sanitizeRect(rect){
  const w=clamp(rect.w,4,100),h=clamp(rect.h,4,100);
  return {x:clamp(rect.x,0,100-w),y:clamp(rect.y,0,100-h),w,h};
}
function bindPointer(editor,box,event){
  if(event.button!==undefined&&event.button!==0)return;
  const key=box.dataset.idEditorKey,card=editor.querySelector('[data-id-editor-card]');if(!key||!card)return;
  selectField(editor,key);
  const bounds=card.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
  const start={...editorDraft[key]},startX:event.clientX,startY:event.clientY,resizing:!!event.target.closest('[data-id-resize-handle]');
  editorDirty=true;feedback(editor,'Unsaved position changes.');
  event.preventDefault();
  box.setPointerCapture?.(event.pointerId);
  const move=moveEvent=>{
    const dx=(moveEvent.clientX-startX)/bounds.width*100,dy=(moveEvent.clientY-startY)/bounds.height*100;
    if(start.resizing){
      const w=clamp(start.w+dx,4,100-start.x),h=clamp(start.h+dy,4,100-start.y);
      editorDraft[key]={...start,w,h};
    }else{
      editorDraft[key]={...start,x:clamp(start.x+dx,0,100-start.w),y:clamp(start.y+dy,0,100-start.h)};
    }
    updateBox(editor,key);
  };
  const end=()=>{box.removeEventListener('pointermove',move);box.removeEventListener('pointerup',end);box.removeEventListener('pointercancel',end)};
  box.addEventListener('pointermove',move);box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
}
function bindEditor(editor){
  editor.querySelectorAll('[data-id-editor-key]').forEach(box=>{
    box.addEventListener('pointerdown',event=>bindPointer(editor,box,event));
    box.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();selectField(editor,box.dataset.idEditorKey);const step=event.shiftKey?1:.2,rect={...editorDraft[selectedKey]};
      if(event.key==='ArrowLeft')rect.x-=step;if(event.key==='ArrowRight')rect.x+=step;if(event.key==='ArrowUp')rect.y-=step;if(event.key==='ArrowDown')rect.y+=step;
      editorDraft[selectedKey]=sanitizeRect(rect);editorDirty=true;updateBox(editor,selectedKey);feedback(editor,'Unsaved position changes.');
    });
  });
  editor.querySelectorAll('[data-id-position-select]').forEach(button=>button.addEventListener('click',()=>selectField(editor,button.dataset.idPositionSelect)));
  editor.querySelectorAll('[data-id-position-input]').forEach(input=>input.addEventListener('change',()=>{
    const field=input.dataset.idPositionInput,rect={...editorDraft[selectedKey]};rect[field]=Number(input.value);editorDraft[selectedKey]=sanitizeRect(rect);editorDirty=true;updateBox(editor,selectedKey);feedback(editor,'Unsaved position changes.');
  }));
  editor.querySelector('[data-save-id-positions]')?.addEventListener('click',()=>savePositions(editor));
  editor.querySelector('[data-reset-id-positions]')?.addEventListener('click',()=>{editorDraft=cloneLayout(DEFAULT_LAYOUT);editorDirty=true;Object.keys(DEFAULT_LAYOUT).forEach(key=>updateBox(editor,key));feedback(editor,'Original positions loaded. Select Save positions to apply them.');});
  editor.querySelector('[data-discard-id-positions]')?.addEventListener('click',()=>{editorDraft=cloneLayout(currentLayout());editorDirty=false;Object.keys(DEFAULT_LAYOUT).forEach(key=>updateBox(editor,key));feedback(editor,'Unsaved changes discarded.');});
  selectField(editor,selectedKey);
}
async function savePositions(editor){
  if(!isAdmin()||!client())return feedback(editor,'Only an administrator can save Digital ID positions.',true);
  const button=editor.querySelector('[data-save-id-positions]');if(button)button.disabled=true;
  feedback(editor,'Saving positions…');
  try{
    const layout=Object.fromEntries(Object.entries(editorDraft).map(([key,rect])=>[key,Object.fromEntries(Object.entries(sanitizeRect(rect)).map(([field,value])=>[field,round(value)]))]));
    const payload={layout_json:layout,updated_at:new Date().toISOString(),updated_by:state().session?.user?.id||null};
    const {data,error}=await client().from('digital_id_template_settings').update(payload).eq('id','default').select('id,template_url,layout_json,updated_at,updated_by').maybeSingle();
    if(error)throw error;if(!data)throw new Error('The Digital ID position settings could not be updated.');
    settings=data;savedLayout=normalizeLayout(data.layout_json);lastSignature=signature(data);editorDraft=cloneLayout(currentLayout());editorDirty=false;applySavedLayout();feedback(editor,'Positions saved. All Digital IDs, downloads, and printed IDs now use this layout.');
    window.dispatchEvent(new CustomEvent('vccf-id-layout-updated'));
  }catch(error){feedback(editor,error?.message||'Unable to save the Digital ID positions.',true)}finally{if(button)button.disabled=false}
}

const observer=new MutationObserver(records=>{
  for(const record of records){
    if(record.type!=='childList'||!record.addedNodes.length)continue;
    for(const node of record.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches?.('.id-template-admin,.id-card')||node.querySelector?.('.id-template-admin,.id-card')){queueEnsureEditor();return}
    }
  }
});
function start(){
  ensureEditorStyles();ensureStyleNode();
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  void syncSettings(true);queueEnsureEditor();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('vccf-app-ready',()=>{void syncSettings(true);queueEnsureEditor()});
window.addEventListener('vccf-id-template-updated',()=>{editorDirty=false;void syncSettings(true)});
window.addEventListener('vccf-id-layout-updated',()=>{void syncSettings(true)});
window.addEventListener('focus',()=>{void syncSettings()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void syncSettings()});
setInterval(()=>{void syncSettings()},30000);
window.addEventListener('vccf-signed-out',()=>{settings=null;savedLayout=null;editorDraft=null;editorDirty=false;lastSignature='';applySavedLayout()});
})();

(()=>{
'use strict';
if(window.__VCCF_MEMBER_PROFILE_MOBILE__)return;
window.__VCCF_MEMBER_PROFILE_MOBILE__=true;

let sheet=null;
const isMobile=()=>matchMedia('(max-width:700px)').matches;

function closeSheet(){sheet?.remove();sheet=null;document.body.classList.remove('m360-sheet-open')}
function originalActions(head){return [...(head?.querySelector('.member-detail-actions')?.querySelectorAll('button')||[])]}
function findAction(head,pattern){return originalActions(head).find(b=>pattern.test((b.textContent||'').trim()))}
function makeToolbar(head){
  if(!head||head.querySelector('.m360-mobile-toolbar'))return;
  const actions=head.querySelector('.member-detail-actions');if(!actions)return;
  head.classList.add('m360-mobile-ready');
  const status=actions.querySelector('.pill');
  const edit=findAction(head,/edit member/i);
  const toolbar=document.createElement('div');toolbar.className='m360-mobile-toolbar';
  if(status){const badge=status.cloneNode(true);badge.removeAttribute('id');badge.classList.add('m360-mobile-status');toolbar.appendChild(badge)}
  if(edit){const primary=document.createElement('button');primary.type='button';primary.className='m360-mobile-primary';primary.textContent='Edit';primary.onclick=()=>edit.click();toolbar.appendChild(primary)}
  const more=document.createElement('button');more.type='button';more.className='m360-mobile-more';more.setAttribute('aria-label','More member actions');more.textContent='•••';more.onclick=()=>openSheet(head);toolbar.appendChild(more);
  head.appendChild(toolbar);
}
function openSheet(head){
  closeSheet();
  const actions=originalActions(head).filter(b=>!(/edit member/i.test((b.textContent||'').trim())));
  sheet=document.createElement('div');sheet.className='m360-action-sheet-backdrop';
  const items=actions.map((button,i)=>{const label=(button.textContent||'Action').trim();const danger=/delete/i.test(label);return `<button type="button" class="m360-sheet-action ${danger?'danger':''}" data-mobile-action="${i}">${label}</button>`}).join('');
  sheet.innerHTML=`<div class="m360-action-sheet" role="dialog" aria-modal="true" aria-label="Member actions"><div class="m360-action-sheet-handle"></div><div class="m360-action-sheet-title"><strong>Member Actions</strong><button type="button" data-sheet-close aria-label="Close">×</button></div><div class="m360-action-sheet-list">${items||'<div class="hint">No additional actions.</div>'}</div></div>`;
  document.body.appendChild(sheet);document.body.classList.add('m360-sheet-open');
  sheet.querySelector('[data-sheet-close]').onclick=closeSheet;
  sheet.onclick=e=>{if(e.target===sheet)closeSheet()};
  sheet.querySelectorAll('[data-mobile-action]').forEach(btn=>btn.onclick=()=>{const action=actions[Number(btn.dataset.mobileAction)];closeSheet();action?.click()});
}
function enhance(){
  const host=document.getElementById('members'),head=host?.querySelector('.m360-head');
  const open=!!head;
  document.body.classList.toggle('m360-profile-open',open&&isMobile());
  if(!open){closeSheet();return}
  if(isMobile())makeToolbar(head);
  else{head.classList.remove('m360-mobile-ready');head.querySelector('.m360-mobile-toolbar')?.remove();closeSheet()}
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',queue,{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
window.addEventListener('vccf-app-ready',queue);window.addEventListener('vccf-signed-out',()=>{closeSheet();document.body.classList.remove('m360-profile-open')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();

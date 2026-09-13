(()=>{
'use strict';
if(window.__VCCF_MEMBER_DELETE_BUTTON__)return;
window.__VCCF_MEMBER_DELETE_BUTTON__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'').trim().toLowerCase().replace(/\s+/g,'_');
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
let activeMemberId=null;

function canDelete(member){
  if(!member)return false;
  if(role()==='admin')return true;
  return role()==='area_leader'&&!!state().profile?.area_id&&String(member.area_id)===String(state().profile.area_id);
}
function ensureStyles(){
  if(document.getElementById('vccfMemberDeleteStyles'))return;
  const style=document.createElement('style');
  style.id='vccfMemberDeleteStyles';
  style.textContent=`
    .vccf-directory-member-delete{display:inline-flex;align-items:center;justify-content:center;margin-top:7px;padding:5px 9px;border:1px solid rgba(185,28,28,.35);border-radius:8px;background:rgba(185,28,28,.08);color:#ef4444;font-size:.68rem;font-weight:850;line-height:1.1;cursor:pointer;white-space:nowrap}
    .vccf-directory-member-delete:hover{background:rgba(185,28,28,.14)}
    .vccf-directory-member-delete:disabled{opacity:.55;cursor:wait}
    @media(max-width:720px){.vccf-directory-member-delete{padding:6px 10px;font-size:.7rem}}
  `;
  document.head.appendChild(style);
}
function toast(message){
  const x=document.getElementById('toast');
  if(!x){console.info(message);return;}
  x.textContent=message;x.classList.add('show');
  clearTimeout(window.__vccfMemberDeleteToast);
  window.__vccfMemberDeleteToast=setTimeout(()=>x.classList.remove('show'),3000);
}
function currentMember(){
  return (state().members||[]).find(m=>String(m.id)===String(activeMemberId))||null;
}
async function deleteMember(member,button){
  if(!canDelete(member)){toast('You do not have permission to delete this member.');return;}
  if(!confirm(`Delete ${memberName(member)}? This will remove the member profile and cannot be undone.`))return;
  const oldText=button?.textContent||'Delete Member';
  if(button){button.disabled=true;button.textContent='Deleting…';}
  try{
    const client=sb();
    if(!client)throw new Error('Database connection unavailable.');
    let query=client.from('members').delete().eq('id',member.id);
    if(role()==='area_leader')query=query.eq('area_id',state().profile?.area_id||'');
    const result=await query.select('id');
    if(result.error)throw result.error;
    if(!result.data?.length)throw new Error('This member could not be deleted. It may be outside your assigned area or already removed.');
    const members=state().members;
    if(Array.isArray(members)){
      const i=members.findIndex(x=>String(x.id)===String(member.id));
      if(i>=0)members.splice(i,1);
    }
    activeMemberId=null;
    document.querySelector(`.member-row[data-member-id="${CSS.escape(String(member.id))}"]`)?.remove();
    window.dispatchEvent(new CustomEvent('vccf-members-changed',{detail:{action:'deleted',memberId:member.id}}));
    window.dispatchEvent(new Event('vccf-members-refresh'));
    toast('Member deleted successfully.');
    const back=document.querySelector('[data-route="members"],.nav [data-view="members"]');
    if(back)setTimeout(()=>back.click(),30);
  }catch(error){
    console.error('Member delete failed',error);
    toast(error?.message||'Unable to delete member.');
    if(button){button.disabled=false;button.textContent=oldText;}
  }
}
function decorateProfileDelete(){
  const actions=document.querySelector('.m360-head .member-detail-actions');
  const existing=document.getElementById('m360delete');
  if(!actions){existing?.remove();return;}
  const member=currentMember();
  if(!member||!canDelete(member)){existing?.remove();return;}
  if(existing)return;
  const button=document.createElement('button');
  button.id='m360delete';
  button.type='button';
  button.className='btn danger';
  button.textContent='Delete Member';
  button.setAttribute('aria-label',`Delete ${memberName(member)}`);
  button.onclick=()=>deleteMember(member,button);
  const edit=document.getElementById('m360edit');
  if(edit)actions.insertBefore(button,edit);else actions.appendChild(button);
}
function decorateDirectoryDeletes(){
  const rows=document.querySelectorAll('#richMemberTable .member-row[data-member-id], .member-directory-table .member-row[data-member-id]');
  rows.forEach(row=>{
    const id=row.dataset.memberId;
    const member=(state().members||[]).find(m=>String(m.id)===String(id));
    const existing=row.querySelector('[data-directory-delete-member]');
    if(!member||!canDelete(member)){existing?.remove();return;}
    if(existing)return;
    const firstCell=row.querySelector('td:first-child');
    const target=firstCell?.querySelector('.member-name > div')||firstCell;
    if(!target)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='vccf-directory-member-delete';
    button.dataset.directoryDeleteMember=String(member.id);
    button.textContent='Delete';
    button.setAttribute('aria-label',`Delete ${memberName(member)}`);
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      deleteMember(member,button);
    });
    target.appendChild(button);
  });
}
function decorate(){
  ensureStyles();
  decorateProfileDelete();
  decorateDirectoryDeletes();
}
function schedule(){setTimeout(decorate,0);setTimeout(decorate,120);setTimeout(decorate,350);}

document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-view-member],[data-member-id]');
  if(target){
    activeMemberId=target.dataset.viewMember||target.dataset.memberId||activeMemberId;
    schedule();
  }
},true);
window.addEventListener('vccf-app-ready',schedule);
window.addEventListener('vccf-member-updated',schedule);
window.addEventListener('vccf-members-refresh',schedule);
window.addEventListener('vccf-members-changed',schedule);
const observer=new MutationObserver(schedule);
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
schedule();
})();

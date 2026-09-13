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
  if(button){button.disabled=true;button.textContent='Deleting…';}
  try{
    const client=sb();
    if(!client)throw new Error('Database connection unavailable.');
    const result=await client.from('members').delete().eq('id',member.id);
    if(result.error)throw result.error;
    const members=state().members;
    if(Array.isArray(members)){
      const i=members.findIndex(x=>String(x.id)===String(member.id));
      if(i>=0)members.splice(i,1);
    }
    activeMemberId=null;
    window.dispatchEvent(new CustomEvent('vccf-members-changed',{detail:{action:'deleted',memberId:member.id}}));
    window.dispatchEvent(new Event('vccf-members-refresh'));
    toast('Member deleted successfully.');
    const back=document.querySelector('[data-route="members"],.nav [data-view="members"]');
    if(back)back.click();
  }catch(error){
    console.error('Member delete failed',error);
    toast(error?.message||'Unable to delete member.');
    if(button){button.disabled=false;button.textContent='Delete Member';}
  }
}
function decorate(){
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
const observer=new MutationObserver(schedule);
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
schedule();
})();

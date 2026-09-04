(()=>{
'use strict';
if(window.__VCCF_NOTIFICATION_ACTIONS_LEADERSHIP_PHOTO__)return;
window.__VCCF_NOTIFICATION_ACTIONS_LEADERSHIP_PHOTO__=true;

const V=()=>window.VCCF;
const sb=()=>V()?.sb;
const state=()=>V()?.getState?.()||{};
const initials=name=>String(name||'Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'M';
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
let busy=false,decorateQueued=false;

function installStyles(){
  if(document.getElementById('vccfNotificationLeadershipFixStyles'))return;
  const style=document.createElement('style');
  style.id='vccfNotificationLeadershipFixStyles';
  style.textContent=`
  .vccf-leader-member{display:flex;align-items:center;gap:10px;min-width:180px}.vccf-leader-photo{width:44px;height:44px;flex:0 0 44px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,rgba(215,25,32,.12),rgba(255,138,24,.16));border:1px solid var(--line);font-size:.76rem;font-weight:900;color:var(--text)}.vccf-leader-photo img{width:100%;height:100%;object-fit:cover;display:block}.vccf-leader-member-copy{min-width:0}.vccf-leader-member-copy b{display:block;overflow-wrap:anywhere}@media(max-width:620px){.vccf-leader-photo{width:40px;height:40px;flex-basis:40px}}
  `;
  document.head.appendChild(style);
}

async function liveSession(){
  const client=sb();
  if(!client)return null;
  let result=await client.auth.getSession(),session=result.data?.session||null;
  if(result.error)throw result.error;
  if(session?.expires_at&&session.expires_at*1000<Date.now()+60000){
    const refreshed=await client.auth.refreshSession();
    if(refreshed.error)throw refreshed.error;
    session=refreshed.data?.session||session;
  }
  return session;
}

function updateBadgeFromDom(){
  const box=document.getElementById('vccfUserInbox');
  const unread=box?box.querySelectorAll('.vccf-user-inbox-row.unread').length:0;
  document.querySelectorAll('.nav [data-route="notifications"],.nav [data-view="notifications"]').forEach(button=>{
    const dot=button.querySelector('.notification-unread-dot');
    if(dot)dot.hidden=!unread;
    button.setAttribute('aria-label',unread?`Notifications, ${unread} unread`:'Notifications');
  });
  if(!box)return;
  const count=box.querySelector('.vccf-user-inbox-head span');
  if(count)count.textContent=`${unread} unread`;
  const markAll=box.querySelector('#vccfMarkAllRead');
  if(markAll&&!unread)markAll.remove();
  if(!box.querySelector('.vccf-user-inbox-row'))box.remove();
}

function setButtonBusy(button,on,label='Working…'){
  if(!button)return;
  if(on){button.dataset.vccfOldText=button.textContent||'';button.disabled=true;button.textContent=label;}
  else{button.disabled=false;if(button.dataset.vccfOldText!==undefined){button.textContent=button.dataset.vccfOldText;delete button.dataset.vccfOldText;}}
}

async function markRead(button,id){
  if(!id||busy)return;
  busy=true;setButtonBusy(button,true,'Marking…');
  try{
    const client=sb(),session=await liveSession(),uid=session?.user?.id;
    if(!client||!uid)throw new Error('Your session is no longer active. Please sign in again.');
    const result=await client.from('vccf_notifications').update({is_read:true}).eq('user_id',uid).eq('id',id).select('id').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)throw new Error('Notification was not updated. Please refresh and try again.');
    const row=button?.closest('.vccf-user-inbox-row,.notify-inbox-row');
    row?.classList.remove('unread');
    button?.remove();
    updateBadgeFromDom();
  }catch(error){console.error('VCCF mark notification read:',error);alert(error?.message||'Unable to mark notification as read.');setButtonBusy(button,false);}
  finally{busy=false;}
}

async function markAllRead(button){
  if(busy)return;
  busy=true;setButtonBusy(button,true,'Marking…');
  try{
    const client=sb(),session=await liveSession(),uid=session?.user?.id;
    if(!client||!uid)throw new Error('Your session is no longer active. Please sign in again.');
    const result=await client.from('vccf_notifications').update({is_read:true}).eq('user_id',uid).eq('is_read',false).select('id');
    if(result.error)throw result.error;
    document.querySelectorAll('#vccfUserInbox .vccf-user-inbox-row.unread,#notifyInbox .notify-inbox-row.unread').forEach(row=>row.classList.remove('unread'));
    document.querySelectorAll('#vccfUserInbox [data-vccf-read],#notifyInbox [data-inbox-read]').forEach(node=>node.remove());
    button?.remove();
    updateBadgeFromDom();
  }catch(error){console.error('VCCF mark all notifications read:',error);alert(error?.message||'Unable to mark notifications as read.');setButtonBusy(button,false);}
  finally{busy=false;}
}

async function deleteNotification(button,id,title){
  if(!id||busy)return;
  if(!confirm(`Delete notification “${title||'Notification'}”?`))return;
  busy=true;setButtonBusy(button,true,'Deleting…');
  try{
    const client=sb(),session=await liveSession(),uid=session?.user?.id;
    if(!client||!uid)throw new Error('Your session is no longer active. Please sign in again.');
    const result=await client.from('vccf_notifications').delete().eq('user_id',uid).eq('id',id).select('id').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)throw new Error('Notification was not deleted. Please refresh and try again.');
    button?.closest('.vccf-user-inbox-row,.notify-inbox-row')?.remove();
    updateBadgeFromDom();
  }catch(error){console.error('VCCF delete notification:',error);alert(error?.message||'Unable to delete notification.');setButtonBusy(button,false);}
  finally{busy=false;}
}

function handleNotificationClick(event){
  const read=event.target.closest?.('[data-vccf-read],[data-inbox-read]');
  const del=event.target.closest?.('[data-vccf-delete]');
  const all=event.target.closest?.('#vccfMarkAllRead,#markAllNotificationsRead');
  if(!read&&!del&&!all)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(read)return void markRead(read,read.dataset.vccfRead||read.dataset.inboxRead);
  if(del)return void deleteNotification(del,del.dataset.vccfDelete,del.dataset.vccfTitle||'Notification');
  void markAllRead(all);
}

function decorateLeadership(){
  decorateQueued=false;
  const host=document.getElementById('church');
  const heading=host?.querySelector('.cms-panel-head h3');
  if(!host||!heading||heading.textContent.trim()!=='Leadership Directory')return;
  const members=state().members||[];
  if(!members.length)return;
  const byName=new Map();
  members.forEach(m=>{const key=memberName(m).trim().toLocaleLowerCase();if(key&&!byName.has(key))byName.set(key,m);});
  host.querySelectorAll('table tbody tr').forEach(row=>{
    const cell=row.cells?.[0];
    if(!cell||cell.dataset.vccfLeaderPhoto==='1'||cell.colSpan>1)return;
    const nameEl=cell.querySelector('b');
    const name=(nameEl?.textContent||cell.textContent||'').trim();
    const member=byName.get(name.toLocaleLowerCase());
    if(!member)return;
    cell.dataset.vccfLeaderPhoto='1';
    const wrap=document.createElement('div');wrap.className='vccf-leader-member';
    const photo=document.createElement('div');photo.className='vccf-leader-photo';
    if(member.photo_url){
      const img=document.createElement('img');img.src=member.photo_url;img.alt=name;img.loading='lazy';img.decoding='async';img.onerror=()=>{photo.textContent=initials(name);};photo.appendChild(img);
    }else photo.textContent=initials(name);
    const copy=document.createElement('div');copy.className='vccf-leader-member-copy';
    while(cell.firstChild)copy.appendChild(cell.firstChild);
    wrap.append(photo,copy);cell.appendChild(wrap);
  });
}

function queueLeadership(){if(decorateQueued)return;decorateQueued=true;setTimeout(decorateLeadership,60);}
function init(){installStyles();document.addEventListener('click',handleNotificationClick,true);queueLeadership();window.addEventListener('vccf-app-ready',queueLeadership);window.addEventListener('focus',queueLeadership);new MutationObserver(queueLeadership).observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(()=>{
'use strict';
if(window.__VCCF_NOTIFICATION_ACTIONS_LEADERSHIP_PHOTO__)return;
window.__VCCF_NOTIFICATION_ACTIONS_LEADERSHIP_PHOTO__=true;

const V=()=>window.VCCF;
const sb=()=>V()?.sb;
const state=()=>V()?.getState?.()||{};
const initials=name=>String(name||'Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'M';
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
let decorateQueued=false,notificationDecorateQueued=false,metaLoading=false,leadershipObserver=null,notificationObserver=null,observedChurch=null,observedNotifications=null;
const notificationMeta=new Map();

function installStyles(){
  if(document.getElementById('vccfNotificationLeadershipFixStyles'))return;
  const style=document.createElement('style');
  style.id='vccfNotificationLeadershipFixStyles';
  style.textContent=`
  .vccf-leader-member{display:flex;align-items:center;gap:10px;min-width:180px}.vccf-leader-photo{width:44px;height:44px;flex:0 0 44px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,rgba(215,25,32,.12),rgba(255,138,24,.16));border:1px solid var(--line);font-size:.76rem;font-weight:900;color:var(--text)}.vccf-leader-photo img{width:100%;height:100%;object-fit:cover;display:block}.vccf-leader-member-copy{min-width:0}.vccf-leader-member-copy b{display:block;overflow-wrap:anywhere}
  .vccf-user-inbox-row>div:first-child{min-width:0}.vccf-user-inbox-actions{position:relative;z-index:20;isolation:isolate;pointer-events:auto!important}.vccf-user-inbox-actions button,.vccf-user-inbox-delete,[data-vccf-delete],[data-vccf-open]{position:relative;z-index:21;pointer-events:auto!important;cursor:pointer!important;touch-action:manipulation}.vccf-notification-open{white-space:nowrap}.vccf-notification-focus{outline:3px solid color-mix(in srgb,var(--brand) 35%,transparent);outline-offset:4px;transition:outline-color .8s}
  @media(max-width:620px){.vccf-leader-photo{width:40px;height:40px;flex-basis:40px}}
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
  if(on){
    if(button.dataset.vccfBusy==='1')return;
    button.dataset.vccfBusy='1';
    button.dataset.vccfOldText=button.textContent||'';
    button.disabled=true;
    button.textContent=label;
  }else{
    button.disabled=false;
    delete button.dataset.vccfBusy;
    if(button.dataset.vccfOldText!==undefined){button.textContent=button.dataset.vccfOldText;delete button.dataset.vccfOldText;}
  }
}

async function markRead(button,id){
  if(!id||button?.dataset.vccfBusy==='1')return;
  setButtonBusy(button,true,'Marking…');
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
}

async function markReadById(id){
  if(!id)return;
  try{
    const client=sb(),session=await liveSession(),uid=session?.user?.id;if(!client||!uid)return;
    await client.from('vccf_notifications').update({is_read:true}).eq('user_id',uid).eq('id',id);
    const row=document.querySelector(`[data-vccf-delete="${CSS.escape(String(id))}"]`)?.closest('.vccf-user-inbox-row,.notify-inbox-row');
    row?.classList.remove('unread');row?.querySelector('[data-vccf-read],[data-inbox-read]')?.remove();updateBadgeFromDom();
  }catch(error){console.warn('VCCF notification read-on-open:',error);}
}

async function markAllRead(button){
  if(button?.dataset.vccfBusy==='1')return;
  setButtonBusy(button,true,'Marking…');
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
}

async function deleteNotification(button,id,title){
  if(!id||button?.dataset.vccfBusy==='1')return;
  if(!confirm(`Delete notification “${title||'Notification'}”?`))return;
  setButtonBusy(button,true,'Deleting…');
  try{
    const client=sb(),session=await liveSession(),uid=session?.user?.id;
    if(!client||!uid)throw new Error('Your session is no longer active. Please sign in again.');
    const result=await client.from('vccf_notifications').delete().eq('user_id',uid).eq('id',id).select('id').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)throw new Error('Notification was not deleted. Please refresh and try again.');
    notificationMeta.delete(String(id));
    button?.closest('.vccf-user-inbox-row,.notify-inbox-row')?.remove();
    updateBadgeFromDom();
  }catch(error){console.error('VCCF delete notification:',error);alert(error?.message||'Unable to delete notification.');setButtonBusy(button,false);}
}

function isActionable(meta){
  if(!meta)return false;
  const source=String(meta.source_type||'').toLowerCase(),url=String(meta.action_url||'');
  return ['sermon','church_event','worship_assignment','message'].includes(source)||meta.kind==='verse'||(url&&url!=='/');
}

async function loadNotificationMeta(ids=[]){
  const client=sb(),uid=state().session?.user?.id;if(!client||!uid||metaLoading)return notificationMeta;
  const wanted=[...new Set(ids.map(String).filter(id=>id&&!notificationMeta.has(id)))];if(!wanted.length)return notificationMeta;
  metaLoading=true;
  try{
    const r=await client.from('vccf_notifications').select('id,kind,is_read,action_url,source_type,source_id,source_key').eq('user_id',uid).in('id',wanted);
    if(r.error)throw r.error;(r.data||[]).forEach(row=>notificationMeta.set(String(row.id),row));
  }catch(error){console.warn('VCCF notification metadata:',error);}finally{metaLoading=false;}
  return notificationMeta;
}

function clickRoute(route){
  const button=document.querySelector(`.nav [data-route="${CSS.escape(String(route))}"]`);
  if(!button)return false;button.click();return true;
}

function focusAfter(selector){
  let attempts=0;const find=()=>{const el=document.querySelector(selector);if(el){el.classList.add('vccf-notification-focus');el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el.classList.remove('vccf-notification-focus'),2200);return}if(++attempts<10)setTimeout(find,180)};setTimeout(find,120);
}

function openWorshipSchedule(){
  const button=document.querySelector('#worshipNavGroup [data-worship-view="schedule"]');
  if(button){button.click();return true;}
  window.location.href='/login#worship-schedule';return true;
}

function handleMetaNavigation(meta){
  const source=String(meta?.source_type||'').toLowerCase(),url=String(meta?.action_url||'');
  if(source==='sermon'){
    if(clickRoute('sermons')){if(meta.source_id)focusAfter(`[data-sermon-card="${CSS.escape(String(meta.source_id))}"]`);return true;}
  }
  if(source==='church_event'){
    if(clickRoute('events')){if(meta.source_id)focusAfter(`[data-event-id="${CSS.escape(String(meta.source_id))}"],[data-event="${CSS.escape(String(meta.source_id))}"]`);return true;}
  }
  if(source==='worship_assignment')return openWorshipSchedule();
  if(meta?.kind==='verse'||/daily-verse/i.test(url)){
    if(clickRoute('dashboard')){focusAfter('#vccfDailyVerseCard');return true;}
  }
  if(url){
    try{
      const target=new URL(url,window.location.origin),route=target.searchParams.get('vccf-route');
      if(route&&clickRoute(route)){
        if(route==='sermons'){const sermon=target.searchParams.get('sermon')||meta?.source_id;if(sermon)focusAfter(`[data-sermon-card="${CSS.escape(String(sermon))}"]`);}
        return true;
      }
      if(target.hash==='#worship-schedule')return openWorshipSchedule();
      if(target.origin===location.origin&&target.pathname==='/app'&&source==='church_event'&&clickRoute('events'))return true;
      window.location.href=target.href;return true;
    }catch(error){console.warn('VCCF notification link:',error);}
  }
  return false;
}

async function openNotification(button,id){
  if(!id||button?.dataset.vccfBusy==='1')return;
  setButtonBusy(button,true,'Opening…');
  try{
    await loadNotificationMeta([id]);const meta=notificationMeta.get(String(id));
    if(!meta)throw new Error('This notification no longer exists.');
    void markReadById(id);
    if(!handleMetaNavigation(meta))throw new Error('There is no linked page for this notification.');
  }catch(error){console.error('VCCF open notification:',error);alert(error?.message||'Unable to open this notification.');setButtonBusy(button,false);}
}

async function decorateNotificationActions(){
  notificationDecorateQueued=false;
  const rows=[...document.querySelectorAll('#vccfUserInbox .vccf-user-inbox-row')];if(!rows.length)return;
  const pairs=rows.map(row=>{const id=row.querySelector('[data-vccf-delete]')?.dataset.vccfDelete||row.querySelector('[data-vccf-read]')?.dataset.vccfRead;return {row,id};}).filter(x=>x.id);
  await loadNotificationMeta(pairs.map(x=>x.id));
  pairs.forEach(({row,id})=>{
    const actions=row.querySelector('.vccf-user-inbox-actions');if(!actions||actions.querySelector(`[data-vccf-open="${CSS.escape(String(id))}"]`))return;
    const meta=notificationMeta.get(String(id));if(!isActionable(meta))return;
    const b=document.createElement('button');b.type='button';b.className='btn vccf-notification-open';b.dataset.vccfOpen=id;b.textContent='Open';actions.insertBefore(b,actions.firstChild);
  });
}

function queueNotificationActions(){if(notificationDecorateQueued)return;notificationDecorateQueued=true;setTimeout(()=>void decorateNotificationActions(),80);}

function handleNotificationClick(event){
  const target=event.target instanceof Element?event.target:event.target?.parentElement;
  const open=target?.closest?.('[data-vccf-open]');
  const read=target?.closest?.('[data-vccf-read],[data-inbox-read]');
  const del=target?.closest?.('[data-vccf-delete]');
  const all=target?.closest?.('#vccfMarkAllRead,#markAllNotificationsRead');
  if(!open&&!read&&!del&&!all)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(open)return void openNotification(open,open.dataset.vccfOpen);
  if(read)return void markRead(read,read.dataset.vccfRead||read.dataset.inboxRead);
  if(del)return void deleteNotification(del,del.dataset.vccfDelete,del.dataset.vccfTitle||'Notification');
  void markAllRead(all);
}

function handlePageDeepLink(){
  try{
    const url=new URL(location.href),route=url.searchParams.get('vccf-route');
    if(!route)return false;
    if(!clickRoute(route))return false;
    if(route==='sermons'){
      const sermon=url.searchParams.get('sermon');if(sermon)focusAfter(`[data-sermon-card="${CSS.escape(String(sermon))}"]`);
    }
    url.searchParams.delete('vccf-route');url.searchParams.delete('sermon');
    const clean=url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:'')+url.hash;
    history.replaceState(history.state,'',clean);
    return true;
  }catch(error){return false;}
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
function bindObservers(){
  const church=document.getElementById('church');
  if(church!==observedChurch){leadershipObserver?.disconnect();observedChurch=church||null;if(church){leadershipObserver=new MutationObserver(queueLeadership);leadershipObserver.observe(church,{childList:true,subtree:true})}}
  const notifications=document.getElementById('notifications');
  if(notifications!==observedNotifications){notificationObserver?.disconnect();observedNotifications=notifications||null;if(notifications){notificationObserver=new MutationObserver(queueNotificationActions);notificationObserver.observe(notifications,{childList:true,subtree:true})}}
}
function init(){
  installStyles();document.addEventListener('click',handleNotificationClick,true);bindObservers();queueLeadership();queueNotificationActions();
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-route="leadership"],[data-route="notifications"],[data-view="notifications"]'))setTimeout(()=>{bindObservers();queueLeadership();queueNotificationActions()},80)},true);
  window.addEventListener('vccf-app-ready',()=>{bindObservers();queueLeadership();queueNotificationActions();setTimeout(handlePageDeepLink,180);setTimeout(handlePageDeepLink,700);});
  window.addEventListener('focus',()=>{if(document.getElementById('notifications')?.classList.contains('active'))queueNotificationActions();if(document.getElementById('church')?.classList.contains('active'))queueLeadership();});
  setTimeout(handlePageDeepLink,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(()=>{
'use strict';
if(window.__VCCF_PWA__)return;window.__VCCF_PWA__=true;

const state={installPrompt:null,registration:null};
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(/macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const supportsNotifications=()=>('serviceWorker' in navigator)&&('Notification' in window);

function ensureHead(){
  if(!document.querySelector('link[rel="manifest"]')){
    const link=document.createElement('link');link.rel='manifest';link.href='/manifest.webmanifest?v=20260904-1';document.head.appendChild(link);
  }
  const metas=[
    ['apple-mobile-web-app-capable','yes'],
    ['apple-mobile-web-app-status-bar-style','default'],
    ['apple-mobile-web-app-title','VCCF Connect']
  ];
  metas.forEach(([name,content])=>{if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m)}});
}

function ensureStyles(){if(document.getElementById('vccfPwaStyles'))return;const s=document.createElement('style');s.id='vccfPwaStyles';s.textContent=`
.pwa-settings-card{display:grid;gap:14px}.pwa-status{display:grid;gap:8px}.pwa-status-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}.pwa-status-row span{color:var(--muted);font-size:.78rem;line-height:1.45}.pwa-status-row b{display:block;margin-bottom:3px}.pwa-badge{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:5px 9px;font-size:.72rem;font-weight:800;white-space:nowrap}.pwa-actions{display:flex;gap:8px;flex-wrap:wrap}.pwa-actions .btn{min-height:44px}.pwa-note{color:var(--muted);font-size:.76rem;line-height:1.5}.pwa-good{color:#167647!important}.pwa-warn{color:#9a3412!important}@media(max-width:620px){.pwa-status-row{flex-direction:column}.pwa-actions{display:grid;grid-template-columns:1fr}.pwa-actions .btn{width:100%}}
`;document.head.appendChild(s)}

async function register(){
  if(!('serviceWorker' in navigator))return null;
  try{state.registration=await navigator.serviceWorker.register('/vccf-sw.js?v=20260904-1',{scope:'/'});return state.registration}catch(error){console.error('VCCF PWA service worker registration failed',error);return null}
}

function installCopy(){
  if(isStandalone())return {badge:'Installed',text:'VCCF Connect is running as an installed app on this device.',action:null};
  if(isIOS())return {badge:'Not installed',text:'On iPhone/iPad, open the Share menu and choose “Add to Home Screen”. Then open VCCF Connect from the new Home Screen icon.',action:'How to install'};
  if(state.installPrompt)return {badge:'Ready to install',text:'This browser can install VCCF Connect as an app.',action:'Install VCCF Connect'};
  return {badge:'Browser mode',text:'Use your browser’s Install app / Add to Home Screen option when available.',action:null};
}

function notificationCopy(){
  if(!supportsNotifications())return {badge:'Unavailable',text:'This browser does not support app notifications.',action:null};
  if(isIOS()&&!isStandalone())return {badge:'Install first',text:'On iPhone/iPad, notifications can be enabled after VCCF Connect is added to the Home Screen.',action:null};
  if(Notification.permission==='granted')return {badge:'Enabled',text:'Notifications are allowed on this device.',action:'Send Test Notification'};
  if(Notification.permission==='denied')return {badge:'Blocked',text:'Notifications are blocked in your device/browser settings. Re-enable them there to continue.',action:null};
  return {badge:'Off',text:'Enable notifications to receive future church announcements and reminders.',action:'Enable Notifications'};
}

async function showTest(){
  const reg=state.registration||await navigator.serviceWorker.ready;
  await reg.showNotification('VCCF Connect',{body:'Notifications are working on this device. This is a local test from VCCF Connect.',icon:'/vccf-app-icon.svg',badge:'/vccf-app-icon.svg',tag:'vccf-local-test',data:{url:'/'}});
}

async function handleNotification(button,msg){
  if(!supportsNotifications())return;
  button.disabled=true;msg.textContent='Checking notification permission…';
  try{
    if(Notification.permission!=='granted'){
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){msg.textContent=permission==='denied'?'Notifications were blocked. You can change this later in device/browser settings.':'Notification permission was not granted.';paint();return}
    }
    await showTest();msg.className='pwa-note pwa-good';msg.textContent='Success — a test notification was sent to this device.';
  }catch(error){msg.className='pwa-note pwa-warn';msg.textContent=error?.message||'Unable to show a test notification on this device.'}
  finally{button.disabled=false;paint(false)}
}

async function handleInstall(button,msg){
  if(isIOS()){msg.className='pwa-note';msg.textContent='iPhone/iPad: tap Share in your browser → Add to Home Screen → Add. Open the new VCCF Connect icon, then return to Settings to enable notifications.';return}
  if(!state.installPrompt)return;
  button.disabled=true;
  try{state.installPrompt.prompt();const choice=await state.installPrompt.userChoice;msg.textContent=choice.outcome==='accepted'?'VCCF Connect was added as an app.':'Installation was not completed.';state.installPrompt=null}
  catch(error){msg.textContent=error?.message||'Unable to open the install prompt.'}
  finally{button.disabled=false;paint(false)}
}

function card(){
  const install=installCopy(),notice=notificationCopy();
  return `<section id="vccfPwaCard" class="settings-card card pwa-settings-card"><div><h3>VCCF Connect App</h3><p>Install VCCF Connect on this device and test system notifications before we turn on church-wide push messages.</p></div><div class="pwa-status"><div class="pwa-status-row"><div><b>App installation</b><span>${install.text}</span></div><span class="pwa-badge">${install.badge}</span></div><div class="pwa-status-row"><div><b>Notifications</b><span>${notice.text}</span></div><span class="pwa-badge">${notice.badge}</span></div></div><div class="pwa-actions">${install.action?`<button id="vccfInstallApp" class="btn secondary" type="button">${install.action}</button>`:''}${notice.action?`<button id="vccfNotifyAction" class="btn" type="button">${notice.action}</button>`:''}</div><div id="vccfPwaMsg" class="pwa-note">Remote push is not enabled yet. This first test verifies installation, permission, service-worker notifications, and mobile behavior.</div></section>`;
}

function paint(replace=true){
  const settings=document.getElementById('settings'),grid=settings?.querySelector('.settings-grid');if(!grid)return;
  ensureStyles();const old=document.getElementById('vccfPwaCard');
  if(replace&&old)old.remove();if(!document.getElementById('vccfPwaCard'))grid.insertAdjacentHTML('beforeend',card());
  const msg=document.getElementById('vccfPwaMsg'),install=document.getElementById('vccfInstallApp'),notify=document.getElementById('vccfNotifyAction');
  if(install)install.onclick=()=>handleInstall(install,msg);if(notify)notify.onclick=()=>handleNotification(notify,msg);
}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.installPrompt=event;paint()});
window.addEventListener('appinstalled',()=>{state.installPrompt=null;paint()});
window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change',()=>paint());

ensureHead();void register().then(()=>paint());
window.addEventListener('vccf-app-ready',()=>setTimeout(()=>paint(),250));
new MutationObserver(()=>{if(document.getElementById('settings')?.classList.contains('active'))queueMicrotask(()=>paint(false))}).observe(document.documentElement,{childList:true,subtree:true});

window.VCCFPWA={isInstalled:isStandalone,registration:()=>state.registration,testNotification:showTest};
})();
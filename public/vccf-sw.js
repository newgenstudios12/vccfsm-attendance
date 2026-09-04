const APP_URL='/';
const APP_ICON='/vccf-app-icon.svg';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json?.()||{}}catch(_){payload={body:event.data?.text?.()||''}}
  const title=payload.title||'VCCF Connect';
  const options={
    body:payload.body||'You have a new VCCF notification.',
    icon:payload.icon||APP_ICON,
    badge:payload.badge||APP_ICON,
    tag:payload.tag||'vccf-notification',
    renotify:Boolean(payload.renotify),
    data:{url:payload.url||APP_URL,...(payload.data||{})}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification?.data?.url||APP_URL,self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        try{if('navigate' in client)await client.navigate(url)}catch(_){}
        return client.focus();
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(url);
  })());
});

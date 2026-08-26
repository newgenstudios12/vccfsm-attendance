(()=>{
'use strict';
if(window.__VCCF_BIRTHDAY_FEATURE_V2__)return;
window.__VCCF_BIRTHDAY_FEATURE_V2__=true;
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const manilaNow=()=>new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Manila'}));
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
function stripBirthdayRequired(){
  const input=document.getElementById('mBirth');
  if(!input)return;
  input.removeAttribute('required');
  const label=input.closest('.field')?.querySelector('label');
  if(label&&label.textContent!=='Birthday (Optional)')label.textContent='Birthday (Optional)';
  input.title='Optional. Leave blank if the birthday is unknown.';
}
function birthdayItems(){
  const now=manilaNow();
  const month=now.getMonth(),today=now.getDate();
  const members=(typeof db!=='undefined'&&Array.isArray(db.members))?db.members:[];
  return members.filter(m=>m?.birthday&&/^\d{4}-\d{2}-\d{2}$/.test(String(m.birthday))&&Number(String(m.birthday).slice(5,7))===month+1)
    .map(m=>({...m,day:Number(String(m.birthday).slice(8,10)),isToday:Number(String(m.birthday).slice(8,10))===today}))
    .sort((a,b)=>Number(b.isToday)-Number(a.isToday)||a.day-b.day||String(a.name).localeCompare(String(b.name)));
}
function renderBirthdayMonth(){
  const box=document.getElementById('birthdayFeature');
  if(!box)return;
  const items=birthdayItems();
  if(!items.length){box.classList.add('hidden');return;}
  const now=manilaNow();
  box.classList.remove('hidden');
  box.innerHTML=`<div style="font-size:.75rem;font-weight:900;letter-spacing:.12em;color:#e66d13">🎂 BIRTHDAY CELEBRATION</div><h3 style="margin:6px 0 6px">Birthdays in ${monthNames[now.getMonth()]}</h3><p style="margin:0 0 16px;color:var(--muted)">${items.some(x=>x.isToday)?'🎉 Today’s birthday is highlighted.':'Here are this month’s birthdays.'}</p><div id="birthdayList" class="birthday-list"></div>`;
  const target=document.getElementById('birthdayList');
  if(!target)return;
  target.innerHTML=items.map(m=>{
    const date=new Date(2000,now.getMonth(),m.day);
    const label=date.toLocaleDateString('en-PH',{month:'long',day:'numeric'});
    const avatar=typeof memberAvatar==='function'?memberAvatar(m):`<span class="member-avatar">${esc(initials(m.name))}</span>`;
    return `<div class="birthday-person" style="${m.isToday?'border:2px solid #ff8a18;background:rgba(255,138,24,.12)':''}">${avatar}<div><b>${esc(m.name)}</b><div style="font-size:.82rem;color:var(--muted)">${m.isToday?'🎉 Birthday today!':label}${m.area?` · ${esc(m.area)}`:''}</div></div></div>`;
  }).join('');
}
function boot(){
  stripBirthdayRequired();
  renderBirthdayMonth();
  setInterval(stripBirthdayRequired,1000);
  window.addEventListener('vccf-app-ready',()=>setTimeout(renderBirthdayMonth,200));
  const originalRefresh=window.refresh;
  if(typeof originalRefresh==='function'&&!window.__VCCF_BIRTHDAY_REFRESH_PATCH__){
    window.__VCCF_BIRTHDAY_REFRESH_PATCH__=true;
    window.refresh=function(){
      const result=originalRefresh.apply(this,arguments);
      setTimeout(()=>{stripBirthdayRequired();renderBirthdayMonth();},75);
      return result;
    };
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,250),{once:true});
else setTimeout(boot,250);
})();

// Public Supabase client configuration.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bmxzdGFlY2pxaGp0aW9qdXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTI1MjQsImV4cCI6MjEwMjYyODUyNH0.2lbYY8dRJEHI-xYsKPG-_8Oe1ByYw_CcPTYmIA9zuF0';

(() => {
  const g = window.supabase;
  const originalCreateClient = g?.createClient;
  if (!originalCreateClient || window.__VCCF_LOGIN_PATCH_V6__) return;
  window.__VCCF_LOGIN_PATCH_V6__ = true;
  const optional = new Set(['areas','members','attendance','photos','site_people']);
  function wrap(builder, table) {
    if (!builder) return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'then' && typeof target.then === 'function') {
          return (resolve, reject) => target.then(result => {
            if (optional.has(table) && result?.error) return resolve({data:[],error:null,count:0,status:200,statusText:'OK'});
            return resolve(result);
          }, reject);
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (table === 'profiles' && prop === 'select' && typeof args[0] === 'string' && args[0].includes('members(*)')) {
            args = ['user_id,role,member_id,area_id,display_name,created_at,updated_at', ...args.slice(1)];
          }
          return wrap(value.apply(target, args), table);
        };
      }
    });
  }
  g.createClient = function(...args) {
    const shared = window.__VCCF_SHARED_SUPABASE_CLIENT__;
    if (shared?.auth) return shared;
    return originalCreateClient.apply(this,args);
  };

  // Authentication is owned exclusively by /vccf-login-guard.js.
  const ABOUT_PHOTO_PREFIX='__ABOUT_PERSON__:';
  const client=window.__VCCF_SHARED_SUPABASE_CLIENT__ || originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  const manilaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const latestSunday=()=>{const d=new Date(manilaDate()+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast2=t=>{const x=document.getElementById('toast');if(x){x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)}};
  const isAdmin=async()=>{const {data:{user}}=await client.auth.getUser();if(!user)return false;const {data}=await client.from('profiles').select('role').eq('user_id',user.id).maybeSingle();return data?.role==='admin'};

  async function updateStatistics(){
    try{
      const [{data:userData},{data:areas},{data:members},{data:attendance},{data:profile}] = await Promise.all([
        client.auth.getUser(),client.from('areas').select('id,name').order('name'),client.from('members').select('id,display_name,area_id,created_at'),client.from('attendance').select('member_id,area_id,checked_in_at'),client.from('profiles').select('role,area_id,member_id').eq('user_id',(await client.auth.getUser()).data.user?.id||'').maybeSingle()
      ]);
      if(!userData?.user)return;
      const visibleMembers=Array.isArray(members)?members:[],visibleIds=new Set(visibleMembers.map(m=>m.id)),sundayDate=latestSunday();
      const sunday=(attendance||[]).filter(a=>visibleIds.has(a.member_id)&&new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})===sundayDate);
      const total=visibleMembers.length,rate=total?Math.round(sunday.length/total*100):0,newCount=visibleMembers.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=Date.now()-30*24*60*60*1000).length;
      const set=(id,val)=>{const x=document.getElementById(id);if(x)x.textContent=String(val)};
      set('totalMembers',total);set('sundayAttendance',sunday.length);set('attendanceRate',rate+'%');set('newMembers',newCount);
      const label=document.getElementById('newMembers')?.previousElementSibling;if(label)label.textContent='New Members (30d)';
      const bars=document.getElementById('areaBars');if(bars){const counts=new Map();sunday.forEach(a=>counts.set(a.area_id,(counts.get(a.area_id)||0)+1));const visibleAreas=(areas||[]).filter(a=>visibleMembers.some(m=>m.area_id===a.id));const max=Math.max(1,...visibleAreas.map(a=>counts.get(a.id)||0));bars.innerHTML=visibleAreas.map(a=>{const n=counts.get(a.id)||0;return `<div class="bar"><b>${esc(a.name.replace(/^Area\s*/i,''))}</b><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><span>${n}</span></div>`}).join('')||'<p style="color:var(--muted)">No areas available.</p>'}
    }catch(e){console.warn('VCCF analytics statistics:',e)}
  }
  async function loadAboutPeople(){const [{data:people,error:peopleError},{data:photos,error:photosError}]=await Promise.all([client.from('site_people').select('*').order('sort_order'),client.from('photos').select('*').order('created_at',{ascending:false})]);if(peopleError)throw peopleError;if(photosError)throw photosError;const photoMap=new Map();(photos||[]).filter(p=>String(p.title||'').startsWith(ABOUT_PHOTO_PREFIX)).forEach(p=>{const id=String(p.title).slice(ABOUT_PHOTO_PREFIX.length);if(!photoMap.has(id))photoMap.set(id,client.storage.from('vccf-gallery').getPublicUrl(p.storage_path).data.publicUrl)});const render=(kind,target,icon)=>{const arr=(people||[]).filter(p=>p.kind===kind),el=document.getElementById(target);if(!el)return;el.innerHTML=arr.map(p=>{const src=photoMap.get(String(p.id));return `<div class="person"><div class="personpic" style="overflow:hidden">${src?`<img src="${esc(src)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`:icon}</div><div><b>${esc(p.name)}</b><div style="color:var(--muted);font-size:.85rem">${esc(p.description||'')}</div></div></div>`}).join('')||'<p style="color:var(--muted)">No people listed yet.</p>'};render('pastor','pastors','✝');render('leader','leaders','♥');return people}
  async function boot(){try{await updateStatistics()}catch{}try{await loadAboutPeople()}catch{} }
  window.addEventListener('vccf-app-ready',()=>setTimeout(boot,100));window.addEventListener('vccf-authenticated',()=>setTimeout(boot,100));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,400),{once:true});else setTimeout(boot,100);
})();

// Public Supabase client configuration.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

(() => {
  const g = window.supabase;
  const originalCreateClient = g?.createClient;
  if (!originalCreateClient || window.__VCCF_LOGIN_PATCH_V5__) return;
  window.__VCCF_LOGIN_PATCH_V5__ = true;
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
    const client = originalCreateClient.apply(this,args);
    const originalFrom = client.from.bind(client);
    client.from = table => wrap(originalFrom(table), table);
    return client;
  };

  // Diagnostic login handler.
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const client = originalCreateClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginUser')?.value.trim();
      const password = document.getElementById('loginPass')?.value;
      const button = form.querySelector('button[type="submit"],button');
      if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
      let box = document.getElementById('vccfLoginError');
      if (!box) { box = document.createElement('div'); box.id='vccfLoginError'; box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap'; form.appendChild(box); }
      box.textContent = '';
      try {
        const { data, error } = await client.auth.signInWithPassword({email,password});
        if (error) throw new Error(`Supabase login: ${error.message} (${error.status || 'no status'})`);
        if (!data?.user) throw new Error('Supabase login returned no user.');
        const { data: p, error: pe } = await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id', data.user.id).maybeSingle();
        if (pe) throw new Error(`Profile lookup: ${pe.message}`);
        if (!p) throw new Error('Login succeeded, but no VCCF profile exists for this Auth user.');
        box.style.background='#ecfdf3'; box.style.color='#027a48'; box.textContent='Authentication succeeded. Loading VCCF…';
        window.location.reload();
      } catch (err) {
        console.error('VCCF login diagnostic:', err);
        box.textContent = err?.message || String(err);
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Sign in'; }
      }
    };
  }, 0));

  const ABOUT_PHOTO_PREFIX='__ABOUT_PERSON__:';
  const client=originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  const manilaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const latestSunday=()=>{
    const d=new Date(manilaDate()+'T12:00:00+08:00');
    d.setDate(d.getDate()-d.getDay());
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast2=t=>{const x=document.getElementById('toast');if(x){x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)}};
  const isAdmin=async()=>{const {data:{user}}=await client.auth.getUser();if(!user)return false;const {data}=await client.from('profiles').select('role').eq('user_id',user.id).maybeSingle();return data?.role==='admin'};

  async function updateStatistics(){
    try{
      const [{data:userData},{data:areas},{data:members},{data:attendance},{data:profile}] = await Promise.all([
        client.auth.getUser(),
        client.from('areas').select('id,name').order('name'),
        client.from('members').select('id,display_name,area_id,created_at'),
        client.from('attendance').select('member_id,area_id,checked_in_at'),
        client.from('profiles').select('role,area_id,member_id').eq('user_id', (await client.auth.getUser()).data.user?.id||'').maybeSingle()
      ]);
      if(!userData?.user) return;
      const role=profile?.role||'admin';
      const visibleMembers=(members||[]).filter(m=>role==='admin'||role===undefined?true:(role==='area_leader'?m.area_id===profile.area_id:m.id===profile.member_id));
      const visibleIds=new Set(visibleMembers.map(m=>m.id));
      const sundayDate=latestSunday();
      const sunday=(attendance||[]).filter(a=>visibleIds.has(a.member_id)&&new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})===sundayDate);
      const total=visibleMembers.length;
      const rate=total?Math.round(sunday.length/total*100):0;
      const recentCutoff=Date.now()-30*24*60*60*1000;
      const newCount=visibleMembers.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=recentCutoff).length;
      const set=(id,val)=>{const x=document.getElementById(id);if(x)x.textContent=String(val)};
      set('totalMembers',total);set('sundayAttendance',sunday.length);set('attendanceRate',rate+'%');set('newMembers',newCount);
      const label=document.getElementById('newMembers')?.previousElementSibling;if(label)label.textContent='New Members (30d)';
      const bars=document.getElementById('areaBars');
      if(bars){
        const areaMap=new Map((areas||[]).map(a=>[a.id,a.name]));
        const counts=new Map();sunday.forEach(a=>counts.set(a.area_id,(counts.get(a.area_id)||0)+1));
        const visibleAreas=(areas||[]).filter(a=>visibleMembers.some(m=>m.area_id===a.id));
        const max=Math.max(1,...visibleAreas.map(a=>counts.get(a.id)||0));
        bars.innerHTML=visibleAreas.map(a=>{const n=counts.get(a.id)||0;return `<div class="bar"><b>${esc(a.name.replace(/^Area\s*/i,''))}</b><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><span>${n}</span></div>`}).join('')||'<p style="color:var(--muted)">No areas available.</p>';
      }
    }catch(e){console.warn('VCCF statistics update failed:',e)}
  }

  async function loadAboutPeople(){
    const [{data:people,error:peopleError},{data:photos,error:photosError}]=await Promise.all([
      client.from('site_people').select('*').order('sort_order'),
      client.from('photos').select('*').order('created_at',{ascending:false})
    ]);
    if(peopleError)throw peopleError;if(photosError)throw photosError;
    const photoMap=new Map();
    (photos||[]).filter(p=>String(p.title||'').startsWith(ABOUT_PHOTO_PREFIX)).forEach(p=>{const id=String(p.title).slice(ABOUT_PHOTO_PREFIX.length);if(!photoMap.has(id))photoMap.set(id,client.storage.from('vccf-gallery').getPublicUrl(p.storage_path).data.publicUrl)});
    const render=(kind,target,icon)=>{
      const arr=(people||[]).filter(p=>p.kind===kind);
      const el=document.getElementById(target);if(!el)return;
      el.innerHTML=arr.map(p=>{const src=photoMap.get(String(p.id));return `<div class="person"><div class="personpic" style="overflow:hidden">${src?`<img src="${esc(src)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`:icon}</div><div><b>${esc(p.name)}</b><div style="color:var(--muted);font-size:.85rem">${esc(p.description||'')}</div></div></div>`}).join('')||'<p style="color:var(--muted)">No people listed yet.</p>';
    };
    render('pastor','pastors','✝');render('leader','leaders','♥');
    return people;
  }

  async function aboutEditor(kind){
    if(!(await isAdmin())){toast2('Only administrators can edit the About page.');return}
    const people=await loadAboutPeople();
    const arr=people.filter(p=>p.kind===kind);
    const title=kind==='pastor'?'Edit pastors':'Edit area leaders';
    const photoRows=arr.map((p,i)=>`<div class="panel" style="margin-bottom:12px;padding:14px"><div style="display:flex;gap:12px;align-items:center"><div id="aboutPrev_${i}" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#d719201a;display:grid;place-items:center;font-weight:900">${esc((p.name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div style="flex:1"><b>${esc(p.name)}</b><div style="font-size:.8rem;color:var(--muted)">Profile picture</div><input id="aboutFile_${i}" type="file" accept="image/*" style="margin-top:6px"></div></div></div>`).join('');
    const modal=document.getElementById('modal'),body=document.getElementById('modalBody'),head=document.getElementById('modalTitle');
    head.textContent=title;
    body.innerHTML=`<div class="field"><label>One person per line: Name | Description</label><textarea id="peopleText" rows="${Math.max(5,arr.length+2)}">${arr.map(p=>p.name+' | '+(p.description||'')).join('\n')}</textarea></div>${photoRows}<button class="btn" id="saveAboutPeople" style="width:100%">Save</button>`;
    modal.classList.add('open');
    for(let i=0;i<arr.length;i++){
      const old=(await client.from('photos').select('storage_path,title').eq('title',ABOUT_PHOTO_PREFIX+arr[i].id).order('created_at',{ascending:false}).limit(1)).data?.[0];
      const prev=document.getElementById('aboutPrev_'+i);
      if(old){const src=client.storage.from('vccf-gallery').getPublicUrl(old.storage_path).data.publicUrl;prev.innerHTML=`<img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover">`}
      document.getElementById('aboutFile_'+i).onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>prev.innerHTML=`<img src="${r.result}" style="width:100%;height:100%;object-fit:cover">`;r.readAsDataURL(f)};
    }
    document.getElementById('saveAboutPeople').onclick=async()=>{
      try{
        const parsed=document.getElementById('peopleText').value.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [name,...rest]=line.split('|');return{name:name.trim(),description:rest.join('|').trim()}});
        for(let i=0;i<parsed.length;i++){
          let p=arr[i];
          if(p){const r=await client.from('site_people').update({name:parsed[i].name,description:parsed[i].description}).eq('id',p.id);if(r.error)throw r.error}
          else{const r=await client.from('site_people').insert({kind,name:parsed[i].name,description:parsed[i].description,sort_order:i}).select('id').single();if(r.error)throw r.error;p=r.data}
          const file=document.getElementById('aboutFile_'+i)?.files?.[0];
          if(file){if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');const path=`about/${p.id}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await client.storage.from('vccf-gallery').upload(path,file,{upsert:false});if(up.error)throw up.error;const ins=await client.from('photos').insert({title:ABOUT_PHOTO_PREFIX+p.id,storage_path:path,taken_on:manilaDate(),featured:false,uploaded_by:(await client.auth.getUser()).data.user?.id||null});if(ins.error)throw ins.error}
        }
        modal.classList.remove('open');await loadAboutPeople();toast2('About page updated.');
      }catch(e){console.error(e);toast2(e.message||'Unable to save About page.')}
    };
  }

  window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    document.querySelectorAll('.nav button[data-view]').forEach(button=>{
      button.onclick=async()=>{
        if(typeof window.openView==='function')window.openView(button.dataset.view);
        if(button.dataset.view==='dashboard')await updateStatistics();
        if(button.dataset.view==='about')try{await loadAboutPeople()}catch(e){console.warn('About page load failed:',e)}
      };
    });
    const ep=document.getElementById('editPastors'),el=document.getElementById('editLeaders');
    if(ep)ep.onclick=()=>aboutEditor('pastor');
    if(el)el.onclick=()=>aboutEditor('leader');
    setTimeout(updateStatistics,1200);
    setTimeout(()=>loadAboutPeople().catch(()=>{}),1200);
  },0));
})();

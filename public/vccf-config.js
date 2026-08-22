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
      const visibleMembers=(members||[]);
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

  // Gallery downloads and editable attendance dates for Admins / Area Leaders.
  async function downloadGalleryPhoto(photo){
    if(!photo?.storage_path){toast2('This photo has no downloadable storage file.');return}
    const {data,error}=await client.storage.from('vccf-gallery').download(photo.storage_path);
    if(error){toast2(error.message);return}
    const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=(photo.storage_path.split('/').pop()||'vccf-photo.jpg').replace(/^[^-]+-/,'');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast2('Photo download started.');
  }

  async function patchAttendanceAndGallery(){
    if(typeof window.renderGallery!=='function'||typeof window.renderAttendance!=='function'||typeof window.checkin!=='function')return false;
    if(window.__VCCF_ATTENDANCE_GALLERY_PATCH__)return true;
    window.__VCCF_ATTENDANCE_GALLERY_PATCH__=true;

    const manual=document.querySelector('.manual-panel');
    if(manual&&!document.getElementById('attendanceDate')){
      const wrap=document.createElement('div');wrap.className='field';wrap.style.margin='10px 0';
      wrap.innerHTML='<label>Attendance date</label><input id="attendanceDate" type="date" class="search" style="width:100%;min-width:0">';
      const select=document.getElementById('manualMember');if(select)select.insertAdjacentElement('afterend',wrap);else manual.appendChild(wrap);
    }
    const dateInput=document.getElementById('attendanceDate');
    if(dateInput){dateInput.value=manilaDate();dateInput.max=manilaDate();dateInput.onchange=()=>{if(dateInput.value>manilaDate()){dateInput.value=manilaDate();toast2('Attendance date cannot be in the future.')}}}

    const originalCheckin=window.checkin;
    window.checkin=async function(id){
      const role=typeof session!=='undefined'?session?.role:null;
      const date=(role==='Admin'||role==='Area Leader')?(document.getElementById('attendanceDate')?.value||manilaDate()):manilaDate();
      if(date>manilaDate()){toast2('Attendance date cannot be in the future.');return}
      if(role==='Member'&&date!==manilaDate()){toast2('Members can only check themselves in for today.');return}
      const m=typeof currentMemberById==='function'?currentMemberById(id):null;
      if(!m){toast2('Invalid member QR.');return}
      if(role==='Member'&&m.id!==session.memberId){toast2('Members can only check in themselves.');return}
      if(role==='Area Leader'&&m.areaId!==session.areaId){toast2('You can only check in members in your assigned area.');return}
      const start=new Date(date+'T00:00:00+08:00').toISOString();const endDate=new Date(date+'T00:00:00+08:00');endDate.setUTCDate(endDate.getUTCDate()+1);const end=endDate.toISOString();
      const {data:existing,error:er}=await client.from('attendance').select('id').eq('member_id',m.id).gte('checked_in_at',start).lt('checked_in_at',end).limit(1);
      if(er){toast2(er.message);return}if(existing?.length){toast2('Already checked in for that date.');return}
      const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
      const checked=new Date(date+'T'+now+'+08:00').toISOString();
      const r=await client.from('attendance').insert({member_id:m.id,area_id:m.areaId,checked_in_by:typeof profile!=='undefined'?profile?.user_id||null:null,source:role==='Member'?'self':'qr',checked_in_at:checked});
      if(r.error){toast2(r.error.message);return}
      await loadDb();refresh();toast2('Attendance recorded.');
    };

    const originalAttendance=window.renderAttendance;
    window.renderAttendance=async function(){
      const {data:rows,error}=await client.from('attendance').select('*').order('checked_in_at',{ascending:false});
      if(error){console.warn(error);return originalAttendance()}
      const tbody=document.getElementById('attendanceRows');if(!tbody)return;
      const role=typeof session!=='undefined'?session?.role:null;
      const visible=(rows||[]).filter(a=>role==='Admin'||(role==='Area Leader'&&a.area_id===session.areaId));
      tbody.innerHTML=visible.map(a=>{
        const m=(typeof db!=='undefined'?db.members:[]).find(x=>x.id===a.member_id)||{name:a.member_id,area:'',photo:''};
        const area=(typeof db!=='undefined'?db.areas:[]).find(x=>x.id===a.area_id)?.name||m.area||'';
        const date=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
        const time=new Date(a.checked_in_at).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'});
        return `<tr><td><div class="member-cell">${typeof memberAvatar==='function'?memberAvatar(m,true):`<b>${esc(m.name)}</b>`}</div></td><td><span class="tag">${esc(area)}</span></td><td>${date}</td><td>${time}</td><td>✓ Present <button class="btn secondary" style="margin-left:8px" onclick="editAttendanceDate('${a.id}')">Edit date</button></td></tr>`;
      }).join('')||'<tr><td colspan="5" style="color:var(--muted)">No attendance recorded yet.</td></tr>';
    };

    window.editAttendanceDate=async function(recordId){
      const {data:a,error}=await client.from('attendance').select('id,member_id,area_id,checked_in_at').eq('id',recordId).maybeSingle();
      if(error||!a){toast2(error?.message||'Attendance record not found.');return}
      const role=typeof session!=='undefined'?session?.role:null;
      if(role!=='Admin'&&!(role==='Area Leader'&&a.area_id===session.areaId)){toast2('You do not have permission to edit this attendance.');return}
      const oldDate=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
      const member=(typeof db!=='undefined'?db.members:[]).find(x=>x.id===a.member_id);
      openModal('Edit attendance date',`<div class="field"><label>Member</label><input value="${esc(member?.name||a.member_id)}" disabled></div><div class="field"><label>Attendance date</label><input id="editAttendanceDate" type="date" value="${oldDate}" max="${manilaDate()}"></div><button class="btn" id="saveAttendanceDate" style="width:100%">Save date</button>`);
      document.getElementById('saveAttendanceDate').onclick=async()=>{
        const date=document.getElementById('editAttendanceDate').value;if(!date){toast2('Choose an attendance date.');return}if(date>manilaDate()){toast2('Attendance date cannot be in the future.');return}
        const time=new Date(a.checked_in_at).toLocaleTimeString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
        const checked=new Date(date+'T'+time+'+08:00').toISOString();
        const r=await client.from('attendance').update({checked_in_at:checked}).eq('id',a.id);if(r.error){toast2(r.error.message);return}
        document.getElementById('modal').classList.remove('open');await loadDb();refresh();toast2('Attendance date updated.');
      };
    };

    const originalGallery=window.renderGallery;
    window.renderGallery=function(){
      originalGallery();
      const grid=document.getElementById('galleryGrid');if(!grid)return;
      [...grid.querySelectorAll('.photo')].forEach((card,i)=>{
        const actions=card.querySelector('.photo-actions');if(!actions||actions.querySelector('.download-photo-btn'))return;
        const btn=document.createElement('button');btn.className='btn secondary download-photo-btn';btn.textContent='Download';btn.onclick=()=>downloadGalleryPhoto((typeof db!=='undefined'?db.photos:[])[i]);actions.insertBefore(btn,actions.firstChild);
      });
    };

    const originalRefresh=window.refresh;
    window.refresh=function(){originalRefresh();setTimeout(()=>{const d=document.getElementById('attendanceDate');if(d){d.value=d.value||manilaDate();d.max=manilaDate()}},0)};
    await window.renderAttendance();
    window.renderGallery();
    return true;
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
    const tryPatch=async()=>{if(await patchAttendanceAndGallery())return;setTimeout(tryPatch,300)};
    tryPatch();
  },0));
})();

// Ensure the attendance export feature is actually loaded by production builds.
// index.html already loads this config file, so this avoids relying on a second
// static <script> tag being present in the deployed HTML.
(() => {
  const loadAttendanceExport = () => {
    if (window.__VCCF_ATTENDANCE_EXPORT_LOADER__) return;
    window.__VCCF_ATTENDANCE_EXPORT_LOADER__ = true;
    if (document.querySelector('script[data-vccf-attendance-export]')) return;
    const script = document.createElement('script');
    script.src = '/vccf-attendance-export.js?v=3';
    script.dataset.vccfAttendanceExport = '1';
    script.onload = () => console.info('VCCF attendance export loaded');
    script.onerror = () => console.error('VCCF attendance export failed to load');
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAttendanceExport, {once:true});
  else loadAttendanceExport();
})();

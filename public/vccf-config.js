// Public Supabase client configuration.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

// Keep optional table reads from blocking the authenticated session.
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

  // Replace the legacy silent login handler with a diagnostic handler after the
  // page has registered its own handler. This uses a separate client so it does
  // not depend on any internal variable from index.html.
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

  // The sidebar buttons exist in index.html, but the navigation click binding
  // was missing. Attach it after the page's openView() function is defined.
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    document.querySelectorAll('.nav button[data-view]').forEach(button => {
      button.onclick = () => {
        if (typeof window.openView === 'function') window.openView(button.dataset.view);
      };
    });
  }, 0));

  // Dashboard/statistics corrections and About-page profile photos.
  const ABOUT_PHOTO_PREFIX = '__ABOUT_PERSON__:';
  const manilaDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const latestSunday = () => {
    const s = manilaDate();
    const d = new Date(s+'T12:00:00+08:00');
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  };
  const initials = name => (name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const escapeHtml = value => String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    if (typeof window.refresh !== 'function') return;
    const originalRefresh = window.refresh;
    const originalRenderGallery = window.renderGallery;

    window.refresh = function(){
      originalRefresh();
      const visibleMembers = typeof window.areaMembers === 'function' ? window.areaMembers() : (window.db?.members||[]);
      const sundayDate = latestSunday();
      const sunday = (window.db?.attendance||[]).filter(a=>a.date===sundayDate && visibleMembers.some(m=>m.id===a.memberId || m.memberCode===a.id));
      const total = visibleMembers.length;
      const rate = total ? Math.round(sunday.length/total*100) : 0;
      const totalEl=document.getElementById('totalMembers');
      const attEl=document.getElementById('sundayAttendance');
      const rateEl=document.getElementById('attendanceRate');
      const newEl=document.getElementById('newMembers');
      if(totalEl) totalEl.textContent=total;
      if(attEl) attEl.textContent=sunday.length;
      if(rateEl) rateEl.textContent=rate+'%';
      if(newEl){
        const cutoff=Date.now()-30*24*60*60*1000;
        const recent=(window.db?.members||[]).filter(m=>m.createdAt && new Date(m.createdAt).getTime()>=cutoff && visibleMembers.some(x=>x.id===m.id)).length;
        newEl.textContent=recent;
        const label=newEl.previousElementSibling;
        if(label) label.textContent='New Members (30d)';
      }
      const bars=document.getElementById('areaBars');
      if(bars){
        const areas=[...new Set(visibleMembers.map(m=>m.area).filter(Boolean))].sort();
        const max=Math.max(1,...areas.map(a=>sunday.filter(x=>x.area===a).length));
        bars.innerHTML=areas.map(a=>{const n=sunday.filter(x=>x.area===a).length;return `<div class="bar"><b>${escapeHtml(a.replace(/^Area\s*/i,''))}</b><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><span>${n}</span></div>`}).join('') || '<p style="color:var(--muted)">No areas available.</p>';
      }
    };

    // Preserve created_at for the new-member statistic, since index.html's
    // mapper intentionally omits it from the member view model.
    const originalLoadDb = window.loadDb;
    if(typeof originalLoadDb==='function'){
      window.loadDb = async function(){
        await originalLoadDb();
        try{
          const client=originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
          const {data}=await client.from('members').select('id,created_at');
          const map=new Map((data||[]).map(x=>[x.id,x.created_at]));
          (window.db?.members||[]).forEach(m=>m.createdAt=map.get(m.id)||null);
        }catch(e){console.warn('Could not load member creation dates',e)}
      };
    }

    // Hide About-person photos from the public gallery and featured-photo strip.
    if(typeof originalRenderGallery==='function'){
      window.renderGallery=function(){
        const all=window.db?.photos||[];
        const publicPhotos=all.filter(p=>!String(p.title||'').startsWith(ABOUT_PHOTO_PREFIX));
        const originalPhotos=window.db.photos;
        window.db.photos=publicPhotos;
        try{originalRenderGallery()}finally{window.db.photos=originalPhotos;}
      };
    }

    window.renderAbout=function(){
      const peoplePhotos=new Map();
      (window.db?.photos||[]).filter(p=>String(p.title||'').startsWith(ABOUT_PHOTO_PREFIX)).forEach(p=>{
        const id=String(p.title).slice(ABOUT_PHOTO_PREFIX.length);
        if(!peoplePhotos.has(id)) peoplePhotos.set(id,p.public_url||'');
      });
      const personCard=(p,icon)=>{
        const src=peoplePhotos.get(String(p.id));
        return `<div class="person"><div class="personpic" style="overflow:hidden">${src?`<img src="${escapeHtml(src)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover">`:`${icon}`}</div><div><b>${escapeHtml(p.name)}</b><div style="color:var(--muted);font-size:.85rem">${escapeHtml(p.desc)}</div></div></div>`;
      };
      document.getElementById('pastors').innerHTML=(window.db?.pastors||[]).map(p=>personCard(p,'✝')).join('')||'<p style="color:var(--muted)">No pastors listed yet.</p>';
      document.getElementById('leaders').innerHTML=(window.db?.leaders||[]).map(p=>personCard(p,'♥')).join('')||'<p style="color:var(--muted)">No area leaders listed yet.</p>';
    };

    window.editPeople=function(type){
      if(window.session?.role!=='Admin') return;
      const arr=type==='pastors'?(window.db?.pastors||[]):(window.db?.leaders||[]);
      const title=type==='pastors'?'Edit pastors':'Edit area leaders';
      const rows=arr.map((p,i)=>`<div class="panel" style="margin-bottom:12px;padding:14px"><div style="display:flex;gap:12px;align-items:center"><div id="aboutPrev_${i}" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#d719201a;display:grid;place-items:center;font-weight:900">${initials(p.name)}</div><div style="flex:1"><b>${escapeHtml(p.name)}</b><div style="font-size:.8rem;color:var(--muted)">Profile picture</div><input id="aboutFile_${i}" type="file" accept="image/*" style="margin-top:6px"></div></div></div>`).join('');
      openModal(title,`<div class="field"><label>One person per line: Name | Description</label><textarea id="peopleText" rows="${Math.max(5,arr.length+2)}">${arr.map(x=>x.name+' | '+x.desc).join('\n')}</textarea></div>${rows}<button class="btn" id="savePeople" style="width:100%">Save</button>`);
      arr.forEach((p,i)=>{
        const existing=(window.db?.photos||[]).find(x=>String(x.title||'')===ABOUT_PHOTO_PREFIX+String(p.id));
        const prev=document.getElementById('aboutPrev_'+i);
        if(existing?.public_url) prev.innerHTML=`<img src="${escapeHtml(existing.public_url)}" style="width:100%;height:100%;object-fit:cover">`;
        document.getElementById('aboutFile_'+i).onchange=e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>prev.innerHTML=`<img src="${r.result}" style="width:100%;height:100%;object-fit:cover">`;r.readAsDataURL(f)}};
      });
      document.getElementById('savePeople').onclick=async()=>{
        const lines=document.getElementById('peopleText').value.split('\n').map(x=>x.trim()).filter(Boolean);
        try{
          const parsed=lines.map(line=>{const [name,...rest]=line.split('|');return{name:name.trim(),desc:rest.join('|').trim()}});
          const table=type==='pastors'?'pastor':'leader';
          for(let i=0;i<parsed.length;i++){
            const old=arr[i];
            if(old){
              const r=await originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY).from('site_people').update({name:parsed[i].name,description:parsed[i].desc}).eq('id',old.id);
              if(r.error) throw r.error;
              const file=document.getElementById('aboutFile_'+i)?.files?.[0];
              if(file) await uploadAboutPhoto(old.id,file);
            }else{
              const r=await originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY).from('site_people').insert({kind:table,name:parsed[i].name,description:parsed[i].desc,sort_order:i}).select('id').single();
              if(r.error) throw r.error;
              const file=document.getElementById('aboutFile_'+i)?.files?.[0];
              if(file) await uploadAboutPhoto(r.data.id,file);
            }
          }
          document.getElementById('modal').classList.remove('open');
          await window.loadDb();
          window.refresh();
          toast('About page updated.');
        }catch(err){console.error(err);toast(err.message||'Unable to save About page.');}
      };
    };

    async function uploadAboutPhoto(personId,file){
      if(!file.type.startsWith('image/')) throw new Error('Please select an image file.');
      const client=originalCreateClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      const path=`about/${personId}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const up=await client.storage.from('vccf-gallery').upload(path,file,{upsert:false});
      if(up.error) throw up.error;
      const ins=await client.from('photos').insert({title:ABOUT_PHOTO_PREFIX+personId,storage_path:path,taken_on:manilaDate(),featured:false,uploaded_by:window.profile?.user_id||null});
      if(ins.error) throw ins.error;
    }

    // Make sure the first refresh uses the corrected functions after all overrides.
    window.renderAbout();
  }, 0));
})();

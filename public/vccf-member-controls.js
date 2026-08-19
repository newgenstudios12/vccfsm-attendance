(() => {
  if (window.__VCCF_MEMBER_CONTROLS_V1__) return;
  window.__VCCF_MEMBER_CONTROLS_V1__ = true;

  const collator = new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
  let sortMode='name', addressFilter='';
  const $ = id => document.getElementById(id);

  function members(){
    if (typeof areaMembers !== 'function' || !Array.isArray(window.db?.members)) return [];
    return areaMembers();
  }

  function ensureControls(){
    const section=$('members');
    if(!section) return false;
    const toolbar=section.querySelector('.toolbar');
    if(!toolbar) return false;
    let box=section.querySelector('#vccfMemberControls');
    if(!box){
      box=document.createElement('div');
      box.id='vccfMemberControls';
      box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px 0;';
      toolbar.insertAdjacentElement('afterend',box);
    }

    if(!$('vccfMemberCount')){
      const count=document.createElement('span');
      count.id='vccfMemberCount';
      count.style.cssText='font-weight:800;color:var(--muted);padding:10px 2px;';
      box.appendChild(count);
    }

    if(!$('vccfSortBy')){
      const wrap=document.createElement('label');
      wrap.style.cssText='display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      wrap.innerHTML='<span>Sort by:</span>';
      const select=document.createElement('select');
      select.id='vccfSortBy';
      select.className='search';
      select.style.minWidth='150px';
      select.innerHTML='<option value="name">Name</option><option value="address">Address</option>';
      select.value=sortMode;
      select.onchange=()=>{sortMode=select.value;render();};
      wrap.appendChild(select);box.appendChild(wrap);
    }

    if(!$('vccfFilterByAddress')){
      const wrap=document.createElement('label');
      wrap.style.cssText='display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      wrap.innerHTML='<span>Filter by: Address</span>';
      const select=document.createElement('select');
      select.id='vccfFilterByAddress';
      select.className='search';
      select.style.minWidth='210px';
      select.onchange=()=>{addressFilter=select.value;applyRowFilter();updateCount();};
      wrap.appendChild(select);box.appendChild(wrap);
    }

    refreshAddressOptions();
    return true;
  }

  function refreshAddressOptions(){
    const select=$('vccfFilterByAddress');
    if(!select) return;
    const values=[...new Set(members().map(m=>String(m.address||'').trim()).filter(Boolean))].sort(collator.compare);
    const current=addressFilter;
    select.innerHTML='<option value="">All addresses</option>' + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('') + '<option value="__blank__">No address</option>';
    select.value=current;
  }

  function escapeHtml(v){return String(v).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));}

  function sortRows(){
    const data=members();
    data.sort((a,b)=>sortMode==='address'
      ? collator.compare(String(a.address||''),String(b.address||'')) || collator.compare(String(a.name||''),String(b.name||''))
      : collator.compare(String(a.name||''),String(b.name||'')));
  }

  function applyRowFilter(){
    const tbody=$('memberRows');
    if(!tbody) return;
    [...tbody.rows].forEach(row=>{
      const address=(row.cells[3]?.textContent||'').trim();
      const show=addressFilter==='__blank__' ? !address : (!addressFilter || address===addressFilter);
      row.style.display=show?'':'none';
    });
  }

  function updateCount(){
    const total=Array.isArray(window.db?.members)?window.db.members.length:0;
    const shown=members().filter(m=>{
      const a=String(m.address||'').trim();
      return addressFilter==='__blank__'?!a:(!addressFilter||a===addressFilter);
    }).length;
    const el=$('vccfMemberCount');
    if(el) el.textContent=`Total members: ${total} · Showing: ${shown}`;
  }

  function render(){
    sortRows();
    if(typeof window.renderMembers==='function') window.renderMembers();
    setTimeout(()=>{refreshAddressOptions();applyRowFilter();updateCount();},80);
  }

  function patchRenderer(){
    if(window.__VCCF_MEMBER_RENDER_PATCHED__) return true;
    if(typeof window.renderMembers!=='function') return false;
    const original=window.renderMembers;
    window.renderMembers=function(...args){
      sortRows();
      const result=original.apply(this,args);
      setTimeout(()=>{refreshAddressOptions();applyRowFilter();updateCount();},0);
      return result;
    };
    window.__VCCF_MEMBER_RENDER_PATCHED__=true;
    return true;
  }

  function boot(){
    ensureControls();
    patchRenderer();
    if($('memberSearch')) $('memberSearch').oninput=()=>setTimeout(()=>{applyRowFilter();updateCount();},0);
    if($('areaFilter')) $('areaFilter').onchange=()=>setTimeout(()=>{refreshAddressOptions();applyRowFilter();updateCount();},0);
    applyRowFilter();updateCount();
  }

  const observer=new MutationObserver(()=>boot());
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100));
  window.addEventListener('vccf-app-ready',()=>setTimeout(boot,100));
  boot();
})();

from pathlib import Path

js_path = Path('public/vccf-worship-ministry.js')
text = js_path.read_text(encoding='utf-8')

old_roles = """  const ROLE_OPTIONS = [
    'Worship Leader','Backup Singer','Keyboard','Acoustic Guitar','Electric Guitar',
    'Bass','Drums','Media / Projection','Sound / Technical','Other'
  ];"""
new_roles = """  const SERVICE_ROLE_OPTIONS = [
    'Worship Leader','Backup Singer','Keyboard','Acoustic Guitar','Electric Guitar',
    'Bass','Drums','Creative Arts','Media / Projection','Sound / Technical','Other'
  ];"""
if old_roles in text:
    text = text.replace(old_roles, new_roles, 1)
elif 'const SERVICE_ROLE_OPTIONS' not in text:
    raise SystemExit('Role options block not found')

text = text.replace(
    '  let schedules=[], members=[];',
    '  let schedules=[], members=[], activeMinistryRoles=[];',
    1,
)

old_nav_css = """      .vccf-worship-nav-group{display:grid;gap:4px;min-width:0}
      .vccf-worship-nav-group .vccf-worship-parent{display:flex!important;align-items:center;justify-content:space-between;gap:8px;width:100%}
      .vccf-worship-nav-group .vccf-worship-parent .wn-label{display:inline-flex;align-items:center;gap:9px;min-width:0}
      .vccf-worship-nav-group .wn-chevron{font-size:.72rem;transition:transform .18s ease}
      .vccf-worship-nav-group.open .wn-chevron{transform:rotate(180deg)}
      .vccf-worship-subnav{display:none;gap:4px;margin:0 0 2px 13px;padding-left:10px;border-left:2px solid color-mix(in srgb,var(--brand) 24%,transparent)}
      .vccf-worship-nav-group.open .vccf-worship-subnav{display:grid}
      .vccf-worship-subnav button{font-size:.76rem!important;padding:9px 10px!important}
"""
text = text.replace(old_nav_css, '', 1)

old_mobile_nav_css = """      @media(max-width:900px){.vccf-worship-nav-group .vccf-worship-parent{justify-content:center}.vccf-worship-nav-group .wn-label span:last-child,.vccf-worship-nav-group .wn-chevron{display:none}.vccf-worship-subnav{margin-left:0;padding-left:0;border-left:0}.vccf-worship-subnav button{font-size:0!important;text-align:center}.vccf-worship-subnav button:before{font-size:1rem}.vccf-worship-subnav button[data-worship-view=\"schedule\"]:before{content:'◷'}.vccf-worship-subnav button[data-worship-view=\"lineup\"]:before{content:'♫'}}
"""
text = text.replace(old_mobile_nav_css, '', 1)

start = text.index('  function mountNav(){')
end = text.index('\n\n  function markNav', start)
mount_nav = '''  function mountNav(){
    if(!canAccess) return;
    const nav=$('.nav'); if(!nav || $('#worshipNavGroup',nav)) return;
    const group=document.createElement('div');
    group.id='worshipNavGroup';
    group.className='nav-group vccf-worship-nav-group';
    group.dataset.worshipNav='1';
    const musicIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
    const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    group.innerHTML=`
      <button class="nav-group-toggle" type="button" aria-expanded="false" title="Worship Ministry">
        <span class="nav-icon">${musicIcon}</span><span class="nav-label">Worship Ministry</span><span class="nav-chevron">${chevron}</span>
      </button>
      <div class="nav-children"><div class="nav-children-inner">
        <button class="nav-item nav-child" type="button" data-worship-view="schedule"><span class="nav-label">Schedule of Ministers</span></button>
        <button class="nav-item nav-child" type="button" data-worship-view="lineup"><span class="nav-label">Worship Line-Up</span></button>
      </div></div>`;
    const finance=$('#financeNavGroup',nav);
    if(finance) finance.insertAdjacentElement('afterend',group);
    else {
      const more=$$('.nav-section-label',nav).find(x=>norm(x.textContent)==='more');
      if(more) nav.insertBefore(group,more); else nav.appendChild(group);
    }
    const toggle=$('.nav-group-toggle',group);
    toggle.addEventListener('click',()=>{
      const open=group.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
    });
    $$('[data-worship-view]',group).forEach(b=>b.addEventListener('click',()=>showModule(b.dataset.worshipView)));
  }'''
text = text[:start] + mount_nav + text[end:]

start = text.index('  function markNav(view){')
end = text.index('\n\n  async function showModule', start)
mark_nav = '''  function markNav(view){
    $$('.nav button').forEach(b=>b.classList.remove('active'));
    const group=$('#worshipNavGroup');
    if(group){
      group.classList.add('open');
      const toggle=$('.nav-group-toggle',group);
      toggle?.setAttribute('aria-expanded','true');
      toggle?.classList.add('active');
    }
    $(`#worshipNavGroup [data-worship-view="${view}"]`)?.classList.add('active');
  }'''
text = text[:start] + mark_nav + text[end:]

load_members_block = """  async function loadMembers(){
    const stateMembers=window.VCCF?.getState?.()?.members||[];
    if(stateMembers.length){members=stateMembers.slice();return members;}
    const r=await sb.from('members').select('id,display_name,first_name,last_name,is_active,status').order('last_name').limit(2000);
    if(r.error) throw r.error;members=r.data||[];return members;
  }
"""
helpers = load_members_block + '''
  async function loadMinistryRoles(){
    const r=await sb.from('ministries').select('name,is_active').eq('is_active',true).order('name');
    if(r.error){console.warn('Unable to load ministry role options:',r.error);activeMinistryRoles=[];return activeMinistryRoles;}
    activeMinistryRoles=(r.data||[]).map(x=>String(x.name||'').trim()).filter(Boolean);
    return activeMinistryRoles;
  }

  function assignmentRoleOptions(){
    const seen=new Set();
    return [...SERVICE_ROLE_OPTIONS,...activeMinistryRoles].filter(name=>{
      const key=norm(name);if(!key||seen.has(key))return false;seen.add(key);return true;
    });
  }

  function assignmentRoleOptionsHtml(){
    const service=SERVICE_ROLE_OPTIONS.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    const serviceKeys=new Set(SERVICE_ROLE_OPTIONS.map(norm));
    const ministry=activeMinistryRoles.filter(r=>!serviceKeys.has(norm(r))).map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    return `<optgroup label="Service Roles">${service}</optgroup>${ministry?`<optgroup label="Existing Ministries">${ministry}</optgroup>`:''}`;
  }
'''
if 'async function loadMinistryRoles()' not in text:
    if load_members_block not in text:
        raise SystemExit('loadMembers block not found')
    text = text.replace(load_members_block, helpers, 1)

old_sort = "const a=(s.worship_schedule_assignments||[]).slice().sort((x,y)=>ROLE_OPTIONS.indexOf(x.ministry_role)-ROLE_OPTIONS.indexOf(y.ministry_role));"
new_sort = "const order=assignmentRoleOptions();const a=(s.worship_schedule_assignments||[]).slice().sort((x,y)=>{const xi=order.indexOf(x.ministry_role),yi=order.indexOf(y.ministry_role);return (xi<0?999:xi)-(yi<0?999:yi)||String(x.ministry_role).localeCompare(String(y.ministry_role));});"
text = text.replace(old_sort, new_sort, 1)

text = text.replace(
    'await Promise.all([loadSchedules(),canManage?loadMembers():Promise.resolve([])]);',
    'await Promise.all([loadSchedules(),canManage?Promise.all([loadMembers(),loadMinistryRoles()]):Promise.resolve([])]);',
    1,
)

text = text.replace(
    '<select name="ministry_role">${ROLE_OPTIONS.map(r=>`<option>${esc(r)}</option>`).join(\'\')}</select>',
    '<select name="ministry_role">${assignmentRoleOptionsHtml()}</select>',
    1,
)

if 'ROLE_OPTIONS' in text:
    raise SystemExit('Legacy ROLE_OPTIONS reference remains')
if 'assignmentRoleOptionsHtml()' not in text:
    raise SystemExit('Dynamic assignment role dropdown was not installed')

js_path.write_text(text, encoding='utf-8')

index_path = Path('public/index.html')
html = index_path.read_text(encoding='utf-8')
html = html.replace(
    '<script src="/vccf-worship-ministry.js?v=20260908-1"></script>',
    '<script src="/vccf-worship-ministry.js?v=20260908-2"></script>',
    1,
)
index_path.write_text(html, encoding='utf-8')

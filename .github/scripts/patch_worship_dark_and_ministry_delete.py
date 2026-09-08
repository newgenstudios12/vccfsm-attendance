from pathlib import Path

worship_path = Path('public/vccf-worship-ministry.js')
worship = worship_path.read_text(encoding='utf-8')

replacements = [
    ("color-mix(in srgb,var(--brand) 9%,var(--panel,#fff)),var(--panel,#fff)", "color-mix(in srgb,var(--brand) 9%,var(--card,#fff)),var(--card,#fff)"),
    (".wm-card{background:var(--panel,var(--card,#fff));", ".wm-card{background:var(--card,#fff);"),
    (".wm-btn.secondary{background:var(--panel,#fff);", ".wm-btn.secondary{background:var(--card,#fff);"),
    ("background:var(--bg);color:var(--text);outline:none}.wm-form textarea", "background:var(--input,var(--bg));color:var(--text);outline:none}.wm-form textarea"),
]
for old, new in replacements:
    if old not in worship and new not in worship:
        raise SystemExit(f'Worship style pattern not found: {old}')
    worship = worship.replace(old, new, 1)

# Extra dark-theme reinforcement for browser/card combinations where inherited variables can lag behind.
dark_css = """      :root[data-theme=\"dark\"] .wm-hero,:root[data-theme=\"dark\"] .wm-card{background-color:var(--card);color:var(--text)}
      :root[data-theme=\"dark\"] .wm-service,:root[data-theme=\"dark\"] .wm-song,:root[data-theme=\"dark\"] .wm-offertory{background:color-mix(in srgb,var(--card) 88%,#000);border-color:var(--line);color:var(--text)}
      :root[data-theme=\"dark\"] .wm-btn.secondary{background:var(--card);color:var(--text);border-color:var(--line)}
      :root[data-theme=\"dark\"] .wm-btn.secondary:hover{background:var(--hover);color:var(--text)}
      :root[data-theme=\"dark\"] .wm-form input,:root[data-theme=\"dark\"] .wm-form select,:root[data-theme=\"dark\"] .wm-form textarea{background:var(--input)!important;color:var(--text)!important;border-color:var(--line)!important}
"""
if ':root[data-theme="dark"] .wm-hero' not in worship:
    marker = "      @media(max-width:760px){"
    if marker not in worship:
        raise SystemExit('Worship media CSS marker not found')
    worship = worship.replace(marker, dark_css + marker, 1)

worship_path.write_text(worship, encoding='utf-8')

cms_path = Path('public/church-management.js')
cms = cms_path.read_text(encoding='utf-8')

old_row = "+(can?'<button class=\"cms-small\" data-assign=\"'+m.id+'\">Assign</button>':'')+'</td></tr>';"
new_row = "+(can?'<button class=\"cms-small\" data-assign=\"'+m.id+'\">Assign</button><button class=\"cms-small danger-text\" data-delete-ministry=\"'+m.id+'\">Delete</button>':'')+'</td></tr>';"
if old_row in cms:
    cms = cms.replace(old_row, new_row, 1)
elif 'data-delete-ministry' not in cms:
    raise SystemExit('Ministry action row pattern not found')

old_bind = "  content().querySelectorAll('[data-edit-ministry]').forEach(b=>b.onclick=()=>ministryForm(data.ministries.find(x=>x.id===b.dataset.editMinistry)));\n  content().querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>membershipForm(b.dataset.assign));"
new_bind = "  content().querySelectorAll('[data-edit-ministry]').forEach(b=>b.onclick=()=>ministryForm(data.ministries.find(x=>x.id===b.dataset.editMinistry)));\n  content().querySelectorAll('[data-delete-ministry]').forEach(b=>b.onclick=()=>deleteMinistry(b.dataset.deleteMinistry));\n  content().querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>membershipForm(b.dataset.assign));"
if old_bind in cms:
    cms = cms.replace(old_bind, new_bind, 1)
elif "[data-delete-ministry]" not in cms:
    raise SystemExit('Ministry event binding pattern not found')

if 'async function deleteMinistry(id)' not in cms:
    marker = 'function ministryForm(m=null){'
    if marker not in cms:
        raise SystemExit('ministryForm marker not found')
    fn = '''async function deleteMinistry(id){
  if(!canManageChurch()) return;
  const m=data.ministries.find(x=>x.id===id); if(!m) return;
  const count=data.ministryMembers.filter(x=>x.ministry_id===id).length;
  const memberNote=count?' This will also remove '+count+' member assignment'+(count===1?'':'s')+'.':'';
  const ok=confirm('Delete ministry "'+m.name+'"?'+memberNote+' Related events, announcements, documents, leadership records, and notifications will be unlinked from this ministry. This cannot be undone.');
  if(!ok) return;
  const r=await sb().from('ministries').delete().eq('id',id).select('id').maybeSingle();
  if(r.error){toast(r.error.message);return;}
  if(!r.data){toast('Ministry could not be deleted. Check your permissions.');return;}
  await writeAudit('delete','ministries',id,{label:'Ministry',name:m.name,removed_memberships:count});
  loaded=false; await loadAll(true); renderActive(); toast('Ministry deleted.',true);
}
'''
    cms = cms.replace(marker, fn + marker, 1)

cms_path.write_text(cms, encoding='utf-8')

index_path = Path('public/index.html')
html = index_path.read_text(encoding='utf-8')
html = html.replace('/church-management.js?v=20260904-1', '/church-management.js?v=20260908-1', 1)
html = html.replace('/vccf-worship-ministry.js?v=20260908-2', '/vccf-worship-ministry.js?v=20260908-3', 1)
index_path.write_text(html, encoding='utf-8')

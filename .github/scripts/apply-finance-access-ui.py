from pathlib import Path

shell_path=Path('public/vccf-app-shell-v2.js')
giving_path=Path('public/vccf-giving.js')
pledges_path=Path('public/vccf-pledges.js')
index_path=Path('public/index.html')

shell=shell_path.read_text()

old="let current='dashboard';\nlet attendanceScanner=null,scanBusy=false;"
new="let current='dashboard';\nlet financeAccess=false,financeAccessResolved=false;\nlet attendanceScanner=null,scanBusy=false;"
assert shell.count(old)==1, 'shell state anchor changed'
shell=shell.replace(old,new,1)

old="const memberLike=()=>['member','treasurer'].includes(role());\nconst roleLabel="
new="const memberLike=()=>['member','treasurer'].includes(role());\nconst roleFinance=()=>['admin','pastor','treasurer'].includes(role());\nconst canFinance=()=>financeAccess===true;\nfunction publishFinanceAccess(value){financeAccess=value===true;financeAccessResolved=true;window.VCCFFinanceAccess=()=>financeAccess;window.dispatchEvent(new CustomEvent('vccf-finance-access',{detail:{allowed:financeAccess}}));return financeAccess}\nasync function resolveFinanceAccess(){if(roleFinance())return publishFinanceAccess(true);const client=window.VCCF?.sb,uid=state().session?.user?.id;if(!client||!uid)return publishFinanceAccess(false);try{const {data,error}=await client.rpc('finance_access');return publishFinanceAccess(!error&&data===true)}catch(_){return publishFinanceAccess(false)}}\nwindow.VCCFFinanceAccess=()=>financeAccess;\nconst roleLabel="
assert shell.count(old)==1, 'shell finance helper anchor changed'
shell=shell.replace(old,new,1)

old="  const attendanceNav=memberLike()?'':navButton('attendance','Attendance','attendance');\n  aside.innerHTML="
new="  const attendanceNav=memberLike()?'':navButton('attendance','Attendance','attendance');\n  aside.innerHTML="
assert shell.count(old)==1, 'shell build anchor changed'
# no textual change here; anchor validates expected build structure

old="  const top=document.querySelector('.top'),first=top?.firstElementChild;"
new="  if(!canFinance())document.getElementById('financeNavGroup')?.remove();\n  const top=document.querySelector('.top'),first=top?.firstElementChild;"
assert shell.count(old)==1, 'shell post-build anchor changed'
shell=shell.replace(old,new,1)

old="function navigate(route){if(route!=='attendance')"
new="function navigate(route){if((route==='giving'||route==='pledges')&&!canFinance())route='dashboard';if(route!=='attendance')"
assert shell.count(old)==1, 'shell navigate anchor changed'
shell=shell.replace(old,new,1)

old="function onReady(){ensureExtraViews();buildShell(true);updateIdentity();prepareAttendanceWorkspace();applyTheme(state().profile?.theme_preference||document.documentElement.dataset.theme||'light');navigate(current)}"
new="async function onReady(){await resolveFinanceAccess();ensureExtraViews();buildShell(true);updateIdentity();prepareAttendanceWorkspace();applyTheme(state().profile?.theme_preference||document.documentElement.dataset.theme||'light');navigate(current)}"
assert shell.count(old)==1, 'shell ready anchor changed'
shell=shell.replace(old,new,1)

shell_path.write_text(shell)

giving=giving_path.read_text()
old="const canManage=()=>['admin','pastor','treasurer'].includes(role());"
new="const canManage=()=>window.VCCFFinanceAccess?.()===true||['admin','pastor','treasurer'].includes(role());"
assert giving.count(old)==1, 'giving canManage anchor changed'
giving=giving.replace(old,new,1)

old="const scopeCopy=()=>role()==='admin'||role()==='pastor'?'Church-wide financial records.':role()==='treasurer'?'Church-wide giving encoding and Sunday finance preparation. Admin/Pastor approval is required.':role()==='area_leader'?'Giving records for members in your assigned area.':'Your personal tithes and offerings history.';"
new="const scopeCopy=()=>role()==='admin'||role()==='pastor'?'Church-wide financial records.':canManage()?'Church-wide giving encoding and Sunday finance preparation. Admin/Pastor approval is required.':'Finance access is restricted.';"
assert giving.count(old)==1, 'giving scope anchor changed'
giving=giving.replace(old,new,1)

old="  if(role()==='treasurer'){\n    const directory=await client.rpc('get_giving_member_directory');"
new="  if(canManage()){\n    const directory=await client.rpc('get_giving_member_directory');"
assert giving.count(old)==1, 'giving directory anchor changed'
giving=giving.replace(old,new,1)

old="function mount(container=document.getElementById('giving')){root=container;if(root){selectedSunday=selectedSunday||latestSunday();refresh(monthKey())}}"
new="function mount(container=document.getElementById('giving')){root=container;if(!root)return;if(!canManage()){root.innerHTML='<div class=\"notice\">Tithes & Offerings is restricted to pastors, administrators, treasurers, and members of the Treasurer ministry.</div>';return}selectedSunday=selectedSunday||latestSunday();refresh(monthKey())}"
assert giving.count(old)==1, 'giving mount anchor changed'
giving=giving.replace(old,new,1)
giving_path.write_text(giving)

pledges=pledges_path.read_text()
old="const finance=()=>['admin','pastor','treasurer'].includes(role());"
new="const finance=()=>window.VCCFFinanceAccess?.()===true||['admin','pastor','treasurer'].includes(role());"
assert pledges.count(old)==1, 'pledges finance anchor changed'
pledges=pledges.replace(old,new,1)

old="function installNavigation(){\n  ensureView();"
new="function installNavigation(){\n  if(!finance())return true;\n  ensureView();"
assert pledges.count(old)==1, 'pledges nav anchor changed'
pledges=pledges.replace(old,new,1)

old="  if(role()==='treasurer'){\n    const result=await sb().rpc('get_giving_member_directory');"
new="  if(finance()){\n    const result=await sb().rpc('get_giving_member_directory');"
assert pledges.count(old)==1, 'pledges directory anchor changed'
pledges=pledges.replace(old,new,1)

old="async function refresh(showLoading=true){\n  ensureView();if(!root||loading)return;loading=true;if(showLoading)root.innerHTML='<div class=\"pledge-loading card\">Loading pledge campaigns…</div>';"
new="async function refresh(showLoading=true){\n  ensureView();if(!root||loading)return;if(!finance()){root.innerHTML='<div class=\"notice\">Pledges is restricted to pastors, administrators, treasurers, and members of the Treasurer ministry.</div>';return}loading=true;if(showLoading)root.innerHTML='<div class=\"pledge-loading card\">Loading pledge campaigns…</div>';"
assert pledges.count(old)==1, 'pledges refresh anchor changed'
pledges=pledges.replace(old,new,1)

old="async function open(){activateShell();await refresh();}"
new="async function open(){if(!finance())return;activateShell();await refresh();}"
assert pledges.count(old)==1, 'pledges open anchor changed'
pledges=pledges.replace(old,new,1)
pledges_path.write_text(pledges)

index=index_path.read_text()
for old,new in [
  ('/vccf-app-shell-v2.js?v=20260904-3','/vccf-app-shell-v2.js?v=20260904-4'),
  ('/vccf-giving.js?v=20260903-4','/vccf-giving.js?v=20260904-5'),
  ('/vccf-pledges.js?v=20260904-1','/vccf-pledges.js?v=20260904-2')
]:
    assert index.count(old)==1, f'index loader anchor changed: {old}'
    index=index.replace(old,new,1)
index_path.write_text(index)

# Safety/access invariants.
shell=shell_path.read_text();giving=giving_path.read_text();pledges=pledges_path.read_text();index=index_path.read_text()
assert "client.rpc('finance_access')" in shell
assert "if(!canFinance())document.getElementById('financeNavGroup')?.remove()" in shell
assert "(route==='giving'||route==='pledges')&&!canFinance()" in shell
assert "window.VCCFFinanceAccess?.()===true" in giving
assert "window.VCCFFinanceAccess?.()===true" in pledges
assert "if(!finance())return true" in pledges
assert '/vccf-finance-nav.js' not in index
print('Finance role/ministry UI access patch applied.')

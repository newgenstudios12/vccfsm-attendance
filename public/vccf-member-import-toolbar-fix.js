(()=>{
'use strict';
if(window.__VCCF_MEMBER_IMPORT_TOOLBAR_FIX__)return;
window.__VCCF_MEMBER_IMPORT_TOOLBAR_FIX__=true;
let timer=0;
const state=()=>window.VCCF?.getState?.()||{};
async function syncRole(){
  const st=state(),client=window.VCCF?.sb,uid=st?.session?.user?.id;
  if(!client||!uid)return;
  try{
    const {data,error}=await client.from('profiles').select('role').eq('user_id',uid).maybeSingle();
    if(!error&&data?.role){
      st.profile=st.profile||{};
      st.profile.role=data.role;
    }
  }catch(_){ }
}
function ensureMembersLoader(){
  if(document.querySelector('script[data-vccf-members-add-loader]'))return;
  const script=document.createElement('script');
  script.src='/vccf-members-add-loader.js?v=20260912-4';
  script.defer=true;
  script.dataset.vccfMembersAddLoader='1';
  script.onerror=()=>console.error('Members enhancement loader failed to load.');
  document.head.appendChild(script);
}
function kickImporter(){
  const root=document.getElementById('members');
  if(!root)return;
  const toolbar=root.querySelector('.member-directory-toolbar')||root.querySelector('.vccf-clean-actions')||root.querySelector('.toolbar');
  if(!toolbar)return;
  const marker=document.createElement('span');
  marker.hidden=true;
  marker.dataset.vccfImportRemount='1';
  toolbar.appendChild(marker);
  setTimeout(()=>marker.remove(),0);
}
async function boot(){
  await syncRole();
  ensureMembersLoader();
  clearTimeout(timer);
  timer=setTimeout(kickImporter,700);
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="members"],[data-view="members"]'))boot()},true);
window.addEventListener('vccf-app-ready',boot);
window.addEventListener('vccf-profile-updated',boot);
setTimeout(boot,500);
})();
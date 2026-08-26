(()=>{
'use strict';
if(window.__VCCF_ACCOUNT_AVATAR_FIX_V1__)return;
window.__VCCF_ACCOUNT_AVATAR_FIX_V1__=true;
const sb=window.supabase;
const client=sb?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
if(!client)return;
const style=()=>{if(document.getElementById('vccfAccountAvatarFixStyle'))return;const s=document.createElement('style');s.id='vccfAccountAvatarFixStyle';s.textContent=`#avatar{width:44px!important;height:44px!important;min-width:44px!important;max-width:44px!important;min-height:44px!important;max-height:44px!important;aspect-ratio:1/1!important;border-radius:50%!important;overflow:hidden!important;padding:0!important;margin:0!important;display:grid!important;place-items:center!important;flex:0 0 44px!important;align-self:center!important;line-height:0!important}#avatar.vccf-avatar-with-photo img{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;display:block!important;object-fit:cover!important;object-position:center center!important;border-radius:50%!important;margin:0!important;padding:0!important}@media(max-width:700px){#avatar{width:40px!important;height:40px!important;min-width:40px!important;max-width:40px!important;min-height:40px!important;max-height:40px!important;flex-basis:40px!important}}`;document.head.appendChild(s)};
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
async function getPhoto(){try{const {data:{user}}=await client.auth.getUser();if(!user)return '';const {data,error}=await client.from('profiles').select('member_id, members(photo_url,display_name)').eq('user_id',user.id).maybeSingle();if(error)return '';return data?.members?.photo_url||''}catch{return ''}}
function initials(name){return String(name||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
async function render(){style();const el=document.getElementById('avatar');if(!el)return;const photo=await getPhoto();const name=document.getElementById('currentName')?.textContent||window.session?.name||'';el.classList.toggle('vccf-avatar-with-photo',!!photo);el.innerHTML=photo?`<img src="${esc(photo)}" alt="${esc(name)}" referrerpolicy="no-referrer">`:`<span style="display:grid;place-items:center;width:100%;height:100%;font:900 14px/1 system-ui,sans-serif">${esc(initials(name))}</span>`}
function boot(){render().catch(()=>{});window.addEventListener('vccf-app-ready',()=>setTimeout(()=>render().catch(()=>{}),150));setTimeout(()=>render().catch(()=>{}),800);window.addEventListener('resize',style)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

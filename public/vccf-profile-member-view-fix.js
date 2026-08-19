(()=>{
'use strict';
if(window.__VCCF_PROFILE_MEMBER_VIEW_FIX_V1__)return;
window.__VCCF_PROFILE_MEMBER_VIEW_FIX_V1__=true;
const roleName=r=>String(r||'').trim().toLowerCase().replace(/_/g,' ');
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
async function getProfile(){const c=client();if(!c)return null;const {data:{user}}=await c.auth.getUser();if(!user)return null;const {data}=await c.from('profiles').select('user_id,role,member_id').eq('user_id',user.id).maybeSingle();return data||null}
async function linkProfile(){try{const c=client();if(!c)return;const p=await getProfile();if(!p||p.member_id)return;const {data,error}=await c.rpc('link_my_member_profile');if(error){console.warn('VCCF profile link:',error);return}if(data){if(typeof window.loadProfile==='function')await window.loadProfile();else location.reload()}}catch(e){console.warn('VCCF profile link:',e)}}
function hideRestrictedControls(role){if(['admin','area leader'].includes(roleName(role)))return;const root=document.querySelector('#members');if(!root)return;root.querySelectorAll('button,.btn,a').forEach(el=>{const t=(el.textContent||'').trim().toLowerCase();const aria=(el.getAttribute('aria-label')||'').toLowerCase();const title=(el.getAttribute('title')||'').toLowerCase();const blob=t+' '+aria+' '+title;if(/qr|generate code|view code|show code|edit member|delete member|change access/.test(blob)){el.hidden=true;el.setAttribute('aria-hidden','true')}});root.querySelectorAll('th').forEach(th=>{if(/^(qr|actions)$/i.test(th.textContent.trim()))th.hidden=true});root.querySelectorAll('td').forEach(td=>{if([...td.querySelectorAll('button,a')].length&&!td.querySelector('button:not([hidden]),a:not([hidden])'))td.hidden=true})}
async function boot(){const p=await getProfile();if(!p)return;await linkProfile();hideRestrictedControls(p.role);const mo=new MutationObserver(()=>hideRestrictedControls(p.role));const root=document.querySelector('#members')||document.body;mo.observe(root,{childList:true,subtree:true});window.addEventListener('vccf-profile-linked',()=>setTimeout(()=>location.reload(),150));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

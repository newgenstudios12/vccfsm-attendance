(()=>{
'use strict';
if(window.__VCCF_PROFILE_AUTO_LINK_V1__)return;
window.__VCCF_PROFILE_AUTO_LINK_V1__=true;
async function run(){try{const c=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);if(!c)return;const {data:{user}}=await c.auth.getUser();if(!user)return;const {data:p,error}=await c.from('profiles').select('member_id').eq('user_id',user.id).maybeSingle();if(error||p?.member_id)return;const {data:memberId}=await c.rpc('link_my_member_profile');if(memberId)setTimeout(()=>location.reload(),200);}catch(e){console.warn('VCCF profile auto-link:',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();

/* VCCF_LOGIN_GUARD_V4
   Single Base44-style authentication boundary.
   Compatibility note: the deployed app uses the Supabase JS CDN client. Keep the
   legacy anon key as the client key because it is the active compatibility key for
   this project; publishable-key support varies by client builds.
*/
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUARD_V4__)return;
window.__VCCF_LOGIN_GUARD_V4__=true;
const AUTH_TIMEOUT=15000;
const LEGACY_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bm...' // placeholder replaced below
})();

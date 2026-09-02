(()=>{
  'use strict';
  const g=window.supabase;
  if(!g?.createClient || window.__VCCF_SUPABASE_SINGLETON_V1__) return;
  window.__VCCF_SUPABASE_SINGLETON_V1__=true;
  const original=g.createClient.bind(g);
  let shared=null;
  g.createClient=function(...args){
    if(!shared) shared=original(...args);
    window.__VCCF_SHARED_SUPABASE_CLIENT__=shared;
    return shared;
  };
})();

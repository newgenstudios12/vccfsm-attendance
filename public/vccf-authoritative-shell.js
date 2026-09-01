(()=>{
'use strict';
if(window.__VCCF_AUTHORITATIVE_SHELL_V1__)return;
window.__VCCF_AUTHORITATIVE_SHELL_V1__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();

function dedupeNav(){
  const nav=$('.sidebar .nav'); if(!nav)return;
  const seen=new Set();
  $$('button,a',nav).forEach(el=>{
    const view=String(el.dataset?.view||'').trim().toLowerCase();
    const label=text(el);
    const key=view||label;
    if(!key)return;
    if(key==='church attendance'||view==='church-attendance'||view==='churchattendance'||view==='attendance'){
      const canonical=el.dataset.view==='attendance'?'attendance':'church-attendance';
      if(seen.has(canonical)){el.remove();return}
      seen.add(canonical);return;
    }
    if(view==='church-management'||label==='church management'){
      if(seen.has('church-management'))el.remove();else seen.add('church-management');return;
    }
    if(view==='profile'||view==='myprofile'||view==='my-profile'||label==='my profile'){
      if(seen.has('profile'))el.remove();else seen.add('profile');return;
    }
  });
}

function repairVisibility(){
  const app=$('#app'),login=$('#login');
  if(!app||!login)return;
  if(app.classList.contains('active')){
    login.style.setProperty('display','none','important');
    app.style.setProperty('display','flex','important');
    if(!$('.main .view.active'))$('#dashboard')?.classList.add('active');
  }
}

function ensureSuite(){
  if(!$('#app')?.classList.contains('active'))return;
  const existing=$('#vccfSuite');
  if(existing)return;
  const old=document.getElementById('vccfAuthoritativeSuiteLoader');
  if(old)return;
  if(window.__VCCF_CHURCH_SUITE__)delete window.__VCCF_CHURCH_SUITE__;
  const s=document.createElement('script');
  s.id='vccfAuthoritativeSuiteLoader';
  s.src='/vccf-church-management-suite.js?authoritative='+Date.now();
  s.onload=()=>setTimeout(()=>window.__VCCF_AUTHORITATIVE_SHELL_REPAIR__?.(),80);
  s.onerror=()=>console.warn('VCCF: Church Management suite failed to load');
  document.head.appendChild(s);
}

function bindSuiteEntry(){
  const nav=$('.sidebar .nav'); if(!nav||nav.dataset.authoritativeSuiteBound==='1')return;
  nav.dataset.authoritativeSuiteBound='1';
  nav.addEventListener('click',e=>{
    const b=e.target.closest?.('button');
    if(!b||!nav.contains(b))return;
    const view=String(b.dataset?.view||'').toLowerCase();
    const label=text(b);
    if(view==='church-management'||label==='church management'){
      e.preventDefault();e.stopImmediatePropagation();
      ensureSuite();
      setTimeout(()=>{
        const hub=$('#churchSuiteView')||$('#suite2-church-management');
        if(hub){$$('.main .view').forEach(v=>v.classList.remove('active'));hub.classList.add('active');$$('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#pageTitle')&&( $('#pageTitle').textContent='Church Management');}
      },60);
    }
  },true);
}

function repair(){repairVisibility();dedupeNav();bindSuiteEntry();ensureSuite();}
window.__VCCF_AUTHORITATIVE_SHELL_REPAIR__=repair;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,50),{once:true});else setTimeout(repair,50);
window.addEventListener('load',()=>setTimeout(repair,50));
window.addEventListener('vccf-authenticated',()=>setTimeout(repair,100));
new MutationObserver(()=>{if($('#app')?.classList.contains('active'))repair();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();

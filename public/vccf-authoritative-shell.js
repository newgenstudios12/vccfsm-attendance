(()=>{
'use strict';
if(window.__VCCF_AUTHORITATIVE_SHELL_V2__)return;
window.__VCCF_AUTHORITATIVE_SHELL_V2__=true;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();

function dedupeNav(){
  const nav=$('.sidebar .nav');if(!nav)return;
  const keep=new Set();
  $$('button,a',nav).forEach(el=>{
    const view=String(el.dataset?.view||'').trim().toLowerCase();
    const label=text(el);
    const isAttendance=label.includes('church attendance')||view==='church-attendance'||view==='churchattendance'||view==='attendance';
    const isChurchMgmt=label==='church management'||view==='church-management';
    const isProfile=label==='my profile'||['profile','myprofile','my-profile'].includes(view);
    const key=isAttendance?'attendance':isChurchMgmt?'church-management':isProfile?'profile':(view||label);
    if(!key)return;
    if(keep.has(key)){el.remove();return}
    keep.add(key);
    if(isAttendance){el.dataset.view='attendance';el.innerHTML='<span aria-hidden="true">✓</span><span class="nav-label">Church Attendance</span>';el.title='Church Attendance';}
  });
}
function repairVisibility(){
  const app=$('#app'),login=$('#login');if(!app||!login)return;
  if(app.classList.contains('active')){login.style.setProperty('display','none','important');app.style.setProperty('display','flex','important');if(!$('.main .view.active'))$('#dashboard')?.classList.add('active');}
}
function ensureScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;document.head.appendChild(s)}
function ensureSuite(){
  if(!$('#app')?.classList.contains('active'))return;
  if(!$('#vccfSuite')){
    const old=document.getElementById('vccfAuthoritativeSuiteLoader');if(!old){
      if(window.__VCCF_CHURCH_SUITE__)delete window.__VCCF_CHURCH_SUITE__;
      ensureScript('vccfAuthoritativeSuiteLoader','/vccf-church-management-suite.js?authoritative='+Date.now());
    }
  }
  if($('#vccfSuite'))ensureScript('vccfMemberGivingScript','/vccf-member-giving.js?authoritative=1');
}
function bindNav(){
  const nav=$('.sidebar .nav');if(!nav||nav.dataset.authoritativeBound==='1')return;nav.dataset.authoritativeBound='1';
  nav.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b||!nav.contains(b))return;
    const v=String(b.dataset?.view||'').toLowerCase();
    if(v==='church-management'||text(b)==='church management'){e.preventDefault();e.stopImmediatePropagation();ensureSuite();setTimeout(()=>{$$('.main .view').forEach(x=>x.classList.remove('active'));($('#churchSuiteView')||$('#suite2-church-management'))?.classList.add('active');$$('button',nav).forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=$('#pageTitle');if(t)t.textContent='Church Management';},100)}
  },true);
}
function repair(){repairVisibility();dedupeNav();bindNav();ensureSuite();}
window.__VCCF_AUTHORITATIVE_SHELL_REPAIR__=repair;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,60),{once:true});else setTimeout(repair,60);
window.addEventListener('load',()=>setTimeout(repair,60));
window.addEventListener('vccf-authenticated',()=>setTimeout(repair,120));
new MutationObserver(()=>{if($('#app')?.classList.contains('active'))repair();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
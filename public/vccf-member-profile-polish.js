(()=>{
'use strict';
if(window.__VCCF_MEMBER_PROFILE_POLISH__)return;
window.__VCCF_MEMBER_PROFILE_POLISH__=true;

let timer=0,observer=null;

function addStyles(){
  if(document.getElementById('vccfMemberProfilePolishCss'))return;
  const s=document.createElement('style');
  s.id='vccfMemberProfilePolishCss';
  s.textContent=`
#members .m360-head{margin-bottom:12px}
#members .m360-head .back-button{border-radius:12px!important;padding:10px 13px!important}
#members .m360-head .member-detail-actions{gap:7px}
#members .m360-head .member-detail-actions .pill{min-height:36px;display:inline-flex;align-items:center;padding:7px 11px}
#members .panel.card:has(.m360-hero){padding:18px;border-radius:20px;overflow:hidden}
#members .m360-hero{position:relative;grid-template-columns:96px minmax(0,1fr) auto;gap:18px;padding:18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(135deg,rgba(215,25,32,.07),rgba(255,138,24,.08) 55%,rgba(255,255,255,0));overflow:hidden}
#members .m360-hero:after{content:'';position:absolute;right:-72px;top:-82px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(239,75,53,.12),rgba(239,75,53,0) 68%);pointer-events:none}
#members .m360-photo{width:96px;height:96px;border-radius:24px;border:3px solid var(--card);box-shadow:0 8px 24px rgba(20,26,36,.12);font-size:1.65rem}
#members .m360-identity h2{font-size:clamp(1.35rem,2.2vw,1.9rem)!important;line-height:1.08;margin-bottom:8px!important;letter-spacing:-.025em}
#members .m360-identity .hint{font-size:.78rem;line-height:1.5}
#members .m360-hero-qr{position:relative;z-index:1;border:1px solid var(--line);background:var(--card);border-radius:15px;padding:9px 10px;box-shadow:0 6px 20px rgba(20,26,36,.06)}
#members .m360-hero-qr .m360-qr{width:92px;height:92px;border-radius:10px;padding:5px}
#members .m360-tabs{margin:15px 0 12px;padding:4px;border:1px solid var(--line);border-radius:14px;background:var(--bg);gap:4px}
#members .m360-tabs button{border:0!important;background:transparent!important;border-radius:10px!important;padding:10px 14px!important;box-shadow:none!important}
#members .m360-tabs button.active{background:var(--card)!important;color:var(--text)!important;box-shadow:0 3px 12px rgba(20,26,36,.08)!important}
#members #m360body{display:grid;gap:12px}
#members .m360-grid{gap:9px}
#members .m360-box{padding:14px;border-radius:14px;background:var(--card);box-shadow:0 3px 12px rgba(20,26,36,.035)}
#members .m360-box span{font-size:.64rem;letter-spacing:.045em}
#members .m360-box strong{font-size:.9rem;line-height:1.45}
#members .m360-summary-grid{margin-top:0;gap:9px}
#members .m360-summary{background:var(--card);border-radius:15px;box-shadow:0 3px 14px rgba(20,26,36,.04)}
#members .m360-summary h3{font-size:.82rem}
#members .mperf-card{order:-10;margin:0!important;padding:17px!important;border:1px solid rgba(215,25,32,.24)!important;border-radius:18px!important;background:linear-gradient(135deg,rgba(215,25,32,.09),rgba(255,138,24,.08) 58%,var(--card) 100%)!important;box-shadow:0 12px 30px rgba(171,39,35,.09)!important;overflow:hidden;position:relative}
#members .mperf-card:before{content:'ATTENDANCE PERFORMANCE';display:inline-flex;margin-bottom:8px;padding:5px 8px;border-radius:999px;background:rgba(215,25,32,.1);color:#b42318;font-size:.58rem;font-weight:900;letter-spacing:.08em}
#members .mperf-card:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;right:-90px;bottom:-105px;background:radial-gradient(circle,rgba(255,138,24,.16),rgba(255,138,24,0) 70%);pointer-events:none}
#members .mperf-head{position:relative;z-index:1;align-items:center}
#members .mperf-head h3{font-size:1.08rem!important;letter-spacing:-.015em;margin-bottom:4px!important}
#members .mperf-head p{max-width:640px;font-size:.72rem!important}
#members .mperf-month input{background:var(--card)!important;min-width:145px}
#members .mperf-metrics{position:relative;z-index:1;grid-template-columns:1.35fr 1fr 1fr;gap:9px;margin-top:13px}
#members .mperf-metric{padding:12px 13px!important;background:rgba(255,255,255,.72)!important;backdrop-filter:blur(5px);border-color:rgba(215,25,32,.13)!important;box-shadow:0 3px 12px rgba(20,26,36,.04)}
html[data-theme=dark] #members .mperf-metric{background:rgba(33,37,43,.84)!important}
#members .mperf-metric:first-child strong{font-size:1.65rem!important;line-height:1;color:#b42318}
html[data-theme=dark] #members .mperf-metric:first-child strong{color:#ff7a6b}
#members .mperf-metric:not(:first-child) strong{font-size:1.18rem!important}
#members .mperf-dots{position:relative;z-index:1;margin-top:13px;padding-top:11px;border-top:1px solid rgba(215,25,32,.12)}
#members .mperf-day i{width:15px!important;height:15px!important}
#members .mperf-legend{position:relative;z-index:1}
#members .m360-alert{border-radius:14px;border-color:rgba(215,25,32,.25);background:linear-gradient(135deg,rgba(215,25,32,.08),rgba(255,138,24,.05));padding:13px 14px}
@media(max-width:760px){
  #members .panel.card:has(.m360-hero){padding:12px}
  #members .m360-hero{grid-template-columns:72px minmax(0,1fr);padding:14px;gap:12px}
  #members .m360-photo{width:72px;height:72px;border-radius:20px}
  #members .m360-hero-qr{grid-column:1/-1;width:100%;display:grid;grid-template-columns:80px minmax(0,1fr);justify-items:start;text-align:left}
  #members .m360-hero-qr .m360-qr{width:74px;height:74px}
  #members .mperf-head{display:grid;gap:10px}
  #members .mperf-month,#members .mperf-month input{width:100%}
  #members .mperf-metrics{grid-template-columns:1fr 1fr}
  #members .mperf-metric:first-child{grid-column:1/-1}
}
@media(max-width:440px){
  #members .m360-head .member-detail-actions{display:grid;grid-template-columns:1fr}
  #members .m360-hero{grid-template-columns:60px minmax(0,1fr)}
  #members .m360-photo{width:60px;height:60px;border-radius:17px}
  #members .m360-grid,.m360-summary-grid{grid-template-columns:1fr!important}
  #members .mperf-card{padding:14px!important}
  #members .mperf-metrics{grid-template-columns:1fr}
  #members .mperf-metric:first-child{grid-column:auto}
}
`;
  document.head.appendChild(s);
}

function polish(){
  addStyles();
  const body=document.getElementById('m360body');
  const hero=document.querySelector('#members .m360-hero');
  if(!body||!hero)return;
  hero.closest('.panel.card')?.classList.add('m360-profile-polished');
  const perf=body.querySelector('.mperf-card');
  if(perf&&body.firstElementChild!==perf)body.prepend(perf);
  body.querySelectorAll('.m360-box').forEach((box,index)=>box.dataset.infoCard=String(index+1));
}

function queue(){clearTimeout(timer);timer=setTimeout(polish,60)}
function watch(){if(observer)return;observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true})}
window.addEventListener('vccf-app-ready',queue);
window.addEventListener('focus',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watch();queue()},{once:true});else{watch();queue()}
})();

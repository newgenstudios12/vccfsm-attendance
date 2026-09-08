(()=>{
'use strict';
if(window.__VCCF_PUBLIC_ORG_CHART__)return;window.__VCCF_PUBLIC_ORG_CHART__=true;

function styles(){if(document.getElementById('vccfPublicOrgChartStyles'))return;const s=document.createElement('style');s.id='vccfPublicOrgChartStyles';s.textContent=`
#leadershipGrid.org-chart-host{display:block!important;overflow:visible}
.vccf-org-chart{display:grid;gap:30px;position:relative;padding:8px 0 4px}
.vccf-org-tier{position:relative;display:grid;gap:14px;justify-items:center}
.vccf-org-tier+.vccf-org-tier{padding-top:30px}
.vccf-org-tier+.vccf-org-tier:before{content:"";position:absolute;top:0;left:50%;width:2px;height:30px;background:linear-gradient(var(--brand),rgba(215,25,32,.22));transform:translateX(-50%)}
.vccf-org-tier-label{display:inline-flex;align-items:center;justify-content:center;padding:7px 12px;border-radius:999px;background:rgba(215,25,32,.08);border:1px solid rgba(215,25,32,.12);color:var(--brand);font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.vccf-org-row{width:100%;display:flex;justify-content:center;align-items:stretch;gap:16px;flex-wrap:wrap;position:relative}
.vccf-org-row .person-card{width:min(290px,calc(33.333% - 12px));min-width:220px;position:relative;padding:23px 20px 21px;box-shadow:0 12px 32px rgba(15,23,42,.07);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.vccf-org-row .person-card:hover{transform:translateY(-3px);box-shadow:0 18px 42px rgba(15,23,42,.11);border-color:rgba(215,25,32,.2)}
.vccf-org-row .person-card .tag{margin-top:1px;background:rgba(215,25,32,.07);color:#a5161b}
.vccf-org-row .person-card h3{font-family:"Plus Jakarta Sans",Manrope,sans-serif;font-size:1.02rem;margin-top:10px}
.vccf-org-about{margin-top:14px!important;padding-top:13px;border-top:1px solid var(--line);text-align:left!important}
.vccf-org-about-label{display:block;margin-bottom:5px;color:var(--brand);font-size:.62rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.vccf-org-empty-about{color:var(--muted);font-style:italic}
@media(max-width:980px){.vccf-org-row .person-card{width:min(330px,calc(50% - 10px))}}
@media(max-width:640px){.vccf-org-chart{gap:22px}.vccf-org-tier+.vccf-org-tier{padding-top:26px}.vccf-org-tier+.vccf-org-tier:before{height:26px}.vccf-org-row{display:grid;grid-template-columns:1fr;gap:12px}.vccf-org-row .person-card{width:100%;min-width:0}.vccf-org-tier-label{font-size:.61rem}}
`;document.head.appendChild(s)}

const tierFor=kind=>{const k=String(kind||'').trim().toLowerCase();if(k.includes('pastor'))return['1','Pastoral Leadership'];if(k.includes('elder')||k.includes('deacon'))return['2','Church Leadership'];if(k.includes('area'))return['3','Area Leadership'];if(k.includes('ministry'))return['4','Ministry Leadership'];return['5','Church Leaders']};

function enhanceCard(card){if(card.dataset.orgEnhanced)return;card.dataset.orgEnhanced='1';const p=card.querySelector('p');if(p){p.classList.add('vccf-org-about');const label=document.createElement('span');label.className='vccf-org-about-label';label.textContent='About the Leader';p.prepend(label)}else{const about=document.createElement('p');about.className='vccf-org-about vccf-org-empty-about';about.innerHTML='<span class="vccf-org-about-label">About the Leader</span>Profile details will be added soon.';card.appendChild(about)}}

function build(){styles();const host=document.getElementById('leadershipGrid');if(!host||host.dataset.orgBuilding==='1')return;const existing=host.querySelector('.vccf-org-chart');if(existing)return;const cards=[...host.querySelectorAll(':scope > .person-card')];if(!cards.length)return;host.dataset.orgBuilding='1';try{const groups=new Map();cards.forEach(card=>{enhanceCard(card);const kind=card.querySelector('.tag')?.textContent||'Leader';const [order,label]=tierFor(kind);const key=order+'|'+label;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card)});const chart=document.createElement('div');chart.className='vccf-org-chart';[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key,items])=>{const tier=document.createElement('section');tier.className='vccf-org-tier';tier.setAttribute('aria-label',key.split('|')[1]);const label=document.createElement('div');label.className='vccf-org-tier-label';label.textContent=key.split('|')[1];const row=document.createElement('div');row.className='vccf-org-row';items.forEach(card=>row.appendChild(card));tier.append(label,row);chart.appendChild(tier)});host.classList.add('org-chart-host');host.innerHTML='';host.appendChild(chart)}finally{host.dataset.orgBuilding='0'}}

function init(){build();const host=document.getElementById('leadershipGrid');if(host)new MutationObserver(()=>build()).observe(host,{childList:true,subtree:false});else new MutationObserver(()=>{const h=document.getElementById('leadershipGrid');if(h){build()}}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

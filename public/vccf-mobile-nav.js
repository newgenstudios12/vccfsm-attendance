(()=>{
'use strict';
if(window.__VCCF_MOBILE_NAV_V3__)return;
window.__VCCF_MOBILE_NAV_V3__=true;
const run=()=>{
  const nav=document.querySelector('.nav');
  if(!nav||nav.dataset.responsiveNav==='v3')return;
  nav.dataset.responsiveNav='v3';
  const buttons=[...nav.querySelectorAll('button')];
  if(!buttons.length)return;

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='mobile-nav-trigger';
  trigger.setAttribute('aria-label','Open navigation');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span></span><span></span><span></span>';

  const backdrop=document.createElement('div');
  backdrop.className='mobile-nav-backdrop';

  const drawer=document.createElement('aside');
  drawer.className='mobile-nav-drawer';
  drawer.setAttribute('aria-label','Main navigation');
  drawer.innerHTML='<div class="mobile-nav-drawer-head"><div class="mobile-nav-brand"><span class="mobile-nav-brand-mark">V</span><div><strong>VCCF Connect</strong><small>Navigation</small></div></div><button type="button" class="mobile-nav-close" aria-label="Close navigation">×</button></div><div class="mobile-nav-drawer-list"></div>';
  const list=drawer.querySelector('.mobile-nav-drawer-list');

  buttons.forEach((button)=>{
    const item=button.cloneNode(true);
    item.classList.remove('mobile-secondary-nav','mobile-more-button');
    item.classList.add('mobile-drawer-item');
    item.addEventListener('click',()=>{button.click();close()});
    list.appendChild(item);
  });

  const closeButton=drawer.querySelector('.mobile-nav-close');
  const close=()=>{
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    trigger.classList.remove('open');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','Open navigation');
    document.body.classList.remove('mobile-nav-open');
  };
  const open=()=>{
    drawer.classList.add('open');
    backdrop.classList.add('open');
    trigger.classList.add('open');
    trigger.setAttribute('aria-expanded','true');
    trigger.setAttribute('aria-label','Close navigation');
    document.body.classList.add('mobile-nav-open');
  };
  trigger.addEventListener('click',()=>drawer.classList.contains('open')?close():open());
  closeButton.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape')close()});

  document.body.appendChild(trigger);
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const syncActive=()=>{
    const active=nav.querySelector('button.active');
    drawer.querySelectorAll('.mobile-drawer-item').forEach((item,index)=>{
      item.classList.toggle('active',!!active&&buttons[index]===active);
    });
  };
  new MutationObserver(syncActive).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  syncActive();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250));else setTimeout(run,250);
})();

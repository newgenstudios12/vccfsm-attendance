(()=>{
'use strict';
if(window.__VCCF_DARK_MODE_FIX_V1__)return;
window.__VCCF_DARK_MODE_FIX_V1__=true;
const valid=v=>v==='dark'||v==='light';
function apply(theme,save=true){const v=valid(theme)?theme:'light';document.documentElement.dataset.theme=v;if(save)localStorage.setItem('vccf-theme',v);updateButton(v);const cb=document.getElementById('themeToggle');if(cb)cb.checked=v==='dark';}
function current(){const d=document.documentElement.dataset.theme;return valid(d)?d:(valid(localStorage.getItem('vccf-theme'))?localStorage.getItem('vccf-theme'):'light')}
function updateButton(v=current()){const b=document.getElementById('vccfDarkModeButton');if(!b)return;b.textContent=v==='dark'?'☀️ Light mode':'🌙 Dark mode';b.setAttribute('aria-pressed',v==='dark'?'true':'false');}
function ensureButton(){if(document.getElementById('vccfDarkModeButton'))return;const top=document.querySelector('.topbar');if(!top)return;const b=document.createElement('button');b.id='vccfDarkModeButton';b.type='button';b.className='btn secondary';b.style.marginLeft='auto';b.addEventListener('click',()=>apply(current()==='dark'?'light':'dark'));const user=top.querySelector('.userchip');if(user)top.insertBefore(b,user);else top.appendChild(b);updateButton();}
function removePickers(){document.getElementById('vccfThemePicker')?.remove();document.getElementById('vccfColorThemePanel')?.remove();document.querySelectorAll('.vccf-theme-picker,.vccf-theme-swatch,[data-color-theme-option]').forEach(e=>e.closest('#vccfThemePicker')?.remove());}
function boot(){removePickers();apply(valid(localStorage.getItem('vccf-theme'))?localStorage.getItem('vccf-theme'):'light',false);ensureButton();updateButton();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
const obs=new MutationObserver(()=>{removePickers();ensureButton();updateButton()});
obs.observe(document.body,{subtree:true,childList:true});
setInterval(()=>{removePickers();ensureButton();updateButton()},1000);
})();

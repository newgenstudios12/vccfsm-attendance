(()=>{
'use strict';
if(window.__VCCF_DARK_MODE_FIX_V2__)return;
window.__VCCF_DARK_MODE_FIX_V2__=true;
const valid=v=>v==='dark'||v==='light';
const saved=()=>{const v=localStorage.getItem('vccf-theme');return valid(v)?v:'light'};
function apply(theme,save=true){const v=valid(theme)?theme:'light';document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v;if(save)localStorage.setItem('vccf-theme',v);const b=document.getElementById('vccfDarkModeButton');if(b){b.textContent=v==='dark'?'☀️ Light mode':'🌙 Dark mode';b.setAttribute('aria-pressed',v==='dark'?'true':'false');}const cb=document.getElementById('themeToggle');if(cb)cb.checked=v==='dark';}
function ensureButton(){if(document.getElementById('vccfDarkModeButton'))return;const top=document.querySelector('.topbar');if(!top)return;const b=document.createElement('button');b.id='vccfDarkModeButton';b.type='button';b.className='btn secondary';b.style.cssText='margin-left:auto;white-space:nowrap;';b.addEventListener('click',()=>apply((document.documentElement.dataset.theme||'light')==='dark'?'light':'dark'));const user=top.querySelector('.userchip');if(user)top.insertBefore(b,user);else top.appendChild(b);}
function removeColorUI(){document.getElementById('vccfThemePicker')?.remove();document.getElementById('vccfColorThemePanel')?.remove();document.querySelectorAll('.vccf-theme-picker').forEach(e=>e.remove());}
function boot(){removeColorUI();apply(saved(),false);ensureButton();apply(document.documentElement.dataset.theme,false);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

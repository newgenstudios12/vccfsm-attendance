(()=>{
'use strict';
if(window.__VCCF_PUBLIC_APPEARANCE__)return;
window.__VCCF_PUBLIC_APPEARANCE__=true;

const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const client=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sections=[
  {id:'home',key:'guest_page_home_image_url',find:()=>document.getElementById('home'),mode:'background'},
  {id:'activity',key:'guest_page_activity_image_url',find:()=>document.querySelector('.hero + .section'),mode:'activity'},
  {id:'services',key:'guest_page_services_image_url',find:()=>document.getElementById('services'),mode:'background'},
  {id:'leadership',key:'guest_page_leadership_image_url',find:()=>document.getElementById('leadership'),mode:'background'},
  {id:'sermons',key:'guest_page_sermons_image_url',find:()=>document.getElementById('sermons'),mode:'background'},
  {id:'events',key:'guest_page_events_image_url',find:()=>document.getElementById('events'),mode:'background'},
  {id:'gallery',key:'guest_page_gallery_image_url',find:()=>document.getElementById('gallery'),mode:'background'},
  {id:'social',key:'guest_page_social_image_url',find:()=>document.getElementById('social'),mode:'background'},
  {id:'about',key:'guest_page_about_image_url',find:()=>document.getElementById('about'),mode:'background'}
];

function ensureStyles(){
  if(document.getElementById('vccfPublicAppearanceStyles'))return;
  const style=document.createElement('style');
  style.id='vccfPublicAppearanceStyles';
  style.textContent='.section.vccf-public-custom-bg{position:relative;isolation:isolate;background-position:center;background-size:cover;background-repeat:no-repeat;color:#fff}.section.vccf-public-custom-bg:before{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,rgba(7,10,16,.76),rgba(7,10,16,.52) 56%,rgba(7,10,16,.34));pointer-events:none}.section.vccf-public-custom-bg>.wrap{position:relative;z-index:1}.section.vccf-public-custom-bg .section-head h2{color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.52)}.section.vccf-public-custom-bg .section-head .section-intro{color:rgba(255,255,255,.92);text-shadow:0 2px 9px rgba(0,0,0,.48)}.section.vccf-public-custom-bg .section-head .section-kicker{color:#ffb15e}@media(max-width:640px){.section.vccf-public-custom-bg:before{background:rgba(7,10,16,.52)}}';
  document.head.appendChild(style);
}

function applyImage(section,url){
  const el=section.find();
  if(!el||!url)return;
  const preload=new Image();
  preload.onload=()=>{
    if(section.mode==='activity'){
      const photo=el.querySelector('.activity-photo');
      if(photo)photo.src=url;
      return;
    }
    el.style.backgroundImage='url('+JSON.stringify(url)+')';
    if(section.id!=='home')el.classList.add('vccf-public-custom-bg');
  };
  preload.onerror=()=>console.warn('Guest page image could not be loaded:',section.id);
  preload.src=url;
}

async function init(){
  if(!client)return;
  ensureStyles();
  try{
    const result=await client.from('site_settings').select('key,value').like('key','guest_page_%');
    if(result.error)throw result.error;
    const settings=Object.fromEntries((result.data||[]).map(row=>[row.key,row.value]));
    sections.forEach(section=>applyImage(section,settings[section.key]));
  }catch(error){
    console.warn('Guest page appearance settings unavailable:',error);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

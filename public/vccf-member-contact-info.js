(()=>{
'use strict';
if(window.__VCCF_MEMBER_CONTACT_INFO__)return;
window.__VCCF_MEMBER_CONTACT_INFO__=true;

const S=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>String(S().profile?.role||'member').toLowerCase();
const canEdit=member=>['admin','pastor'].includes(role())||(role()==='area_leader'&&String(member?.area_id||'')===String(S().profile?.area_id||''));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const fmtBirthday=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric'}).format(new Date(String(v)+'T12:00:00+08:00')):'Not recorded';
let leadership=[];
let hydration=null;
let timer=0;

function memberFromProfile(){
  const key=String(document.querySelector('.m360-qr-code')?.textContent||'').trim();
  if(!key)return null;
  return (S().members||[]).find(m=>String(m.id)===key||String(m.member_code||'')===key)||null;
}
async function hydrate(force=false){
  if(hydration&&!force)return hydration;
  const client=sb();if(!client)return;
  hydration=(async()=>{
    const [mr,lr]=await Promise.all([
      client.from('members').select('id,contact_number,email,birth_date'),
      client.from('church_leadership').select('id,member_id,contact_number,email,leadership_type,role_title')
    ]);
    if(!mr.error){const map=new Map((mr.data||[]).map(x=>[String(x.id),x]));(S().members||[]).forEach(m=>{const x=map.get(String(m.id));if(x)Object.assign(m,x)})}
    if(!lr.error)leadership=lr.data||[];
  })();
  try{await hydration}finally{hydration=null}
}
function contactMarkup(member){
  const phone=String(member?.contact_number||'').trim(),email=String(member?.email||'').trim();
  if(!phone&&!email)return '<span class="hint">Not recorded</span>';
  return (phone?`<div><a href="tel:${esc(phone)}">${esc(phone)}</a></div>`:'')+(email?`<div><a href="mailto:${esc(email)}">${esc(email)}</a></div>`:'');
}
function ensureStyles(){
  if(document.getElementById('vccfMemberContactCss'))return;
  const s=document.createElement('style');s.id='vccfMemberContactCss';s.textContent=`
  .m360-contact-link a{color:var(--text);text-decoration:none;overflow-wrap:anywhere}.m360-contact-link a:hover{text-decoration:underline}
  .vccf-leader-contact{min-width:190px}.vccf-leader-contact a{display:block;color:var(--text);text-decoration:none;line-height:1.45;overflow-wrap:anywhere}.vccf-leader-contact a:hover{text-decoration:underline}
  @media(max-width:720px){.vccf-leader-contact{min-width:160px}}
  `;document.head.appendChild(s);
}
function patchMemberProfile(){
  const body=document.getElementById('m360body'),member=memberFromProfile();if(!body||!member)return;
  const grid=body.querySelector('.m360-grid');if(!grid)return;
  if(!grid.querySelector('[data-vccf-member-birthday]')){
    const birthday=document.createElement('div');birthday.className='m360-box';birthday.dataset.vccfMemberBirthday='1';birthday.innerHTML=`<span>Birthday</span><strong>${esc(fmtBirthday(member.birth_date))}</strong>`;grid.appendChild(birthday);
  }
  if(!grid.querySelector('[data-vccf-member-phone]')){
    const box=document.createElement('div');box.className='m360-box m360-contact-link';box.dataset.vccfMemberPhone='1';box.innerHTML=`<span>Contact number</span><strong>${member.contact_number?`<a href="tel:${esc(member.contact_number)}">${esc(member.contact_number)}</a>`:'Not recorded'}</strong>`;grid.appendChild(box);
  }
  if(!grid.querySelector('[data-vccf-member-email]')){
    const box=document.createElement('div');box.className='m360-box m360-contact-link';box.dataset.vccfMemberEmail='1';box.innerHTML=`<span>Email</span><strong>${member.email?`<a href="mailto:${esc(member.email)}">${esc(member.email)}</a>`:'Not recorded'}</strong>`;grid.appendChild(box);
  }
}
function patchMemberEdit(){
  const wrap=document.getElementById('m360EditOverlay'),form=wrap?.querySelector('form'),member=memberFromProfile();if(!form||!member||form.dataset.vccfContactReady)return;
  form.dataset.vccfContactReady='1';
  const birth=form.querySelector('input[name="birth_date"]')?.closest('label');
  const phone=document.createElement('label');phone.innerHTML=`Contact number <span class="hint" style="font-weight:600;margin:0">Optional</span><input name="contact_number" type="tel" value="${esc(member.contact_number||'')}" placeholder="e.g. 09xx xxx xxxx">`;
  const email=document.createElement('label');email.innerHTML=`Email <span class="hint" style="font-weight:600;margin:0">Optional</span><input name="contact_email" type="email" value="${esc(member.email||'')}" placeholder="name@example.com">`;
  if(birth){birth.insertAdjacentElement('afterend',email);birth.insertAdjacentElement('afterend',phone)}else{form.prepend(email);form.prepend(phone)}
  form.addEventListener('submit',()=>{
    const contact=String(form.elements.contact_number?.value||'').trim(),mail=String(form.elements.contact_email?.value||'').trim();
    if(!canEdit(member))return;
    sb()?.rpc('update_member_contact_fields',{p_member_id:member.id,p_contact_number:contact||null,p_email:mail||null}).then(({data,error})=>{
      const msg=document.getElementById('m360EditMsg');
      if(error){if(msg){msg.style.color='#b42318';msg.textContent='Member saved, but contact info could not be updated: '+error.message}return}
      member.contact_number=contact||null;member.email=mail||null;if(data&&typeof data==='object')Object.assign(member,Array.isArray(data)?data[0]||{}:data);
    });
  },true);
}
function findMemberByName(text){const n=String(text||'').trim().toLowerCase();return (S().members||[]).find(m=>memberName(m).trim().toLowerCase()===n)||null}
function patchLeadershipDirectory(){
  const panel=[...document.querySelectorAll('#cmsContent .cms-panel')].find(p=>p.querySelector('h3')?.textContent.trim()==='Leadership Directory');if(!panel)return;
  const table=panel.querySelector('table'),head=table?.querySelector('thead tr');if(!table||!head)return;
  if(!head.querySelector('[data-vccf-contact-head]')){const th=document.createElement('th');th.dataset.vccfContactHead='1';th.textContent='Contact';head.insertBefore(th,head.children[4]||null)}
  table.querySelectorAll('tbody tr').forEach(row=>{
    if(row.querySelector('[data-vccf-leader-contact]')||row.children.length<5)return;
    const member=findMemberByName(row.querySelector('td:first-child b')?.textContent);if(!member)return;
    const td=document.createElement('td');td.dataset.vccfLeaderContact='1';td.className='vccf-leader-contact';td.innerHTML=contactMarkup(member);row.insertBefore(td,row.children[4]||null);
  });
}
function patchLeadershipForm(){
  const modal=document.getElementById('cmsModal'),form=modal?.querySelector('#cmsModalForm');if(!form||form.dataset.vccfLeadershipContactReady)return;
  const title=modal.querySelector('h3')?.textContent||'';if(!/Leadership Assignment/i.test(title))return;
  form.dataset.vccfLeadershipContactReady='1';
  const memberSelect=form.querySelector('select[name="member_id"]');if(!memberSelect)return;
  const block=document.createElement('div');block.className='cms-form-grid';block.dataset.vccfLeadershipContact='1';block.innerHTML='<label>Contact number<input name="leader_contact_number" type="tel" placeholder="Optional"></label><label>Email<input name="leader_contact_email" type="email" placeholder="Optional"></label>';
  const firstGrid=form.querySelector('.cms-form-grid');firstGrid?.insertAdjacentElement('afterend',block)||memberSelect.closest('label')?.insertAdjacentElement('afterend',block);
  const fill=()=>{const m=(S().members||[]).find(x=>String(x.id)===String(memberSelect.value));form.elements.leader_contact_number.value=m?.contact_number||'';form.elements.leader_contact_email.value=m?.email||''};
  memberSelect.addEventListener('change',fill);fill();
  form.addEventListener('submit',()=>{
    const id=memberSelect.value;if(!id)return;const member=(S().members||[]).find(x=>String(x.id)===String(id));if(!member||!canEdit(member))return;
    const contact=String(form.elements.leader_contact_number?.value||'').trim(),mail=String(form.elements.leader_contact_email?.value||'').trim();
    sb()?.rpc('update_member_contact_fields',{p_member_id:id,p_contact_number:contact||null,p_email:mail||null}).then(({data,error})=>{if(!error){member.contact_number=contact||null;member.email=mail||null;if(data&&typeof data==='object')Object.assign(member,Array.isArray(data)?data[0]||{}:data)}});
  },true);
}
async function run(){ensureStyles();await hydrate();patchMemberProfile();patchMemberEdit();patchLeadershipDirectory();patchLeadershipForm()}
function queue(){clearTimeout(timer);timer=setTimeout(()=>void run(),90)}
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();

(()=>{
'use strict';
if(window.__VCCF_MEMBERS_ADD_BRIDGE__)return;
window.__VCCF_MEMBERS_ADD_BRIDGE__=true;
function start(){
  const state=window.VCCF?.getState?.();
  if(!state?.session?.user||!window.VCCF?.sb)return false;
  if(document.querySelector('script[data-vccf-members-add-loader]'))return true;
  const script=document.createElement('script');
  script.src='/vccf-members-add-loader.js?v=20260905-3';
  script.dataset.vccfMembersAddLoader='1';
  script.onerror=()=>console.error('Add Member loader could not be started. Other VCCF features are unaffected.');
  document.head.appendChild(script);
  return true;
}
window.addEventListener('vccf-app-ready',start);
window.addEventListener('focus',start);
start();
})();

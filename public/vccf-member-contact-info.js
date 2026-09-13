(()=>{
'use strict';
if(window.__VCCF_MEMBER_CONTACT_INFO__)return;
window.__VCCF_MEMBER_CONTACT_INFO__=true;

const S=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>String(S().profile?.role||'member').toLowerCase();
const canEdit=member=>['admin','pastor'].includes(role())||(role()==='area_leader'&&!!S().profile?.area_id&&String(member?.area_id||'')===String(S().profile?.area_id||''));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const fmtBirthday=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric'}).format(new Date(String(v)+'T12:00:00+08:00')):'Not recorded';
let leadership=[];
let hydration=null;
let timer=0;
let activeMemberId=null;

function memberFromProfile(){
  const key=String(document.querySelector('.m360-qr-code')?.textContent||'').trim();
  if(!key)return null;
  return (S().members||[]).find(m=>String(m.id)===key||String(m.member_number||'')===key||String(m.member_code||'')===key)||null;
}
function appShellMember(){
  const card=document.querySelector('#members .member-profile-card');
  if(!card)return null;
  let member=activeMemberId?(S().members||[]).find(m=>String(m.id)===String(activeMemberId)):null;
  if(!member){
    const title=String(card.querySelector('h2')?.textContent||'').trim().toLowerCase();
    member=(S().members||[]).find(m=>memberName(m).trim().toLowerCase()===title)||null;
  }
  return member;
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
function singleContactMarkup(kind,value){
  const text=String(value||'').trim();
  if(!text)return 'Not recorded';
  const href=kind==='phone'?'tel:':'mailto:';
  return `<a href="${href}${esc(text)}">${esc(text)}</a>`;
}
function ensureStyles(){
  if(document.getElementById('vccfMemberContactCss'))return;
  const s=document.createElement('style');s.id='vccfMemberContactCss';s.textContent=`
  .m360-contact-link a,.vccf-member-contact-value a{color:var(--text);text-decoration:none;overflow-wrap:anywhere}.m360-contact-link a:hover,.vccf-member-contact-value a:hover{text-decoration:underline}
  .vccf-leader-contact{min-width:190px}.vccf-leader-contact a{display:block;color:var(--text);text-decoration:none;line-height:1.45;overflow-wrap:anywhere}.vccf-leader-contact a:hover{text-decoration:underline}
  .vccf-contact-overlay{position:fixed;inset:0;z-index:420;background:rgba(8,12,18,.55);display:grid;place-items:center;padding:16px}.vccf-contact-card{width:min(520px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--card,#fff);color:var(--text);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.22)}.vccf-contact-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.vccf-contact-head h3{margin:0}.vccf-contact-close{border:1px solid var(--line);background:var(--bg);color:var(--text);width:42px;height:42px;border-radius:12px;font-size:1.25rem}.vccf-contact-form{display:grid;gap:12px}.vccf-contact-form label{display:grid;gap:6px;color:var(--muted);font-size:.78rem;font-weight:800}.vccf-contact-form input{width:100%;min-height:46px;border:1px solid var(--line);border-radius:11px;background:var(--bg);color:var(--text);padding:10px 11px}.vccf-contact-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.vccf-contact-msg{margin-right:auto;min-height:18px;font-size:.8rem;color:#b42318}.vccf-contact-scope{padding:10px 12px;border-radius:12px;background:var(--bg);color:var(--muted);font-size:.76rem;line-height:1.45}
  @media(max-width:720px){.vccf-leader-contact{min-width:160px}.vccf-contact-overlay{align-items:end;padding:8px}.vccf-contact-card{width:100%;max-height:calc(100dvh - 16px)}.vccf-contact-actions{display:grid;grid-template-columns:1fr 1fr}.vccf-contact-msg{grid-column:1/-1;margin:0}.vccf-contact-actions .btn{width:100%}}
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
function openContactEditor(member){
  if(!member||!canEdit(member))return;
  document.getElementById('vccfContactEditOverlay')?.remove();
  const wrap=document.createElement('div');wrap.id='vccfContactEditOverlay';wrap.className='vccf-contact-overlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Edit contact details');
  const scope=role()==='area_leader'?'You can edit contact details for members assigned to your area.':'Contact details are updated separately from the rest of the member record.';
  wrap.innerHTML=`<div class="vccf-contact-card"><div class="vccf-contact-head"><div><h3>Edit contact details</h3><div class="hint">${esc(memberName(member))}</div></div><button class="vccf-contact-close" type="button" aria-label="Close">×</button></div><form class="vccf-contact-form"><label>Contact number <span class="hint" style="font-weight:600;margin:0">Optional</span><input name="contact_number" type="tel" value="${esc(member.contact_number||'')}" placeholder="e.g. 09xx xxx xxxx" autocomplete="tel"></label><label>Email <span class="hint" style="font-weight:600;margin:0">Optional</span><input name="contact_email" type="email" value="${esc(member.email||'')}" placeholder="name@example.com" autocomplete="email"></label><div class="vccf-contact-scope">${esc(scope)}</div><div class="vccf-contact-actions"><span class="vccf-contact-msg" role="status"></span><button class="btn secondary" type="button" data-contact-cancel>Cancel</button><button class="btn" type="submit">Save contact</button></div></form></div>`;
  document.body.appendChild(wrap);
  const close=()=>wrap.remove(),form=wrap.querySelector('form'),msg=wrap.querySelector('.vccf-contact-msg'),submit=form.querySelector('button[type="submit"]');
  wrap.querySelector('.vccf-contact-close').onclick=close;wrap.querySelector('[data-contact-cancel]').onclick=close;wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
  form.onsubmit=async e=>{
    e.preventDefault();if(!canEdit(member)){msg.textContent='You no longer have permission to edit this member.';return}
    const contact=String(form.elements.contact_number?.value||'').trim(),mail=String(form.elements.contact_email?.value||'').trim();
    submit.disabled=true;submit.textContent='Saving…';msg.textContent='';
    try{
      const {data,error}=await sb().rpc('update_member_contact_fields',{p_member_id:member.id,p_contact_number:contact||null,p_email:mail||null});
      if(error)throw error;
      member.contact_number=contact||null;member.email=mail||null;if(data&&typeof data==='object')Object.assign(member,Array.isArray(data)?data[0]||{}:data);
      patchAppShellProfile();patchMemberProfile();window.dispatchEvent(new CustomEvent('vccf-member-updated',{detail:{memberId:member.id,fields:['contact_number','email']}}));
      msg.style.color='#167647';msg.textContent='Contact details saved.';submit.textContent='Saved';setTimeout(close,350);
    }catch(err){msg.style.color='#b42318';msg.textContent=err?.message||'Unable to save contact details.';submit.disabled=false;submit.textContent='Save contact'}
  };
  form.elements.contact_number?.focus();
}
function patchAppShellProfile(){
  const card=document.querySelector('#members .member-profile-card'),member=appShellMember();if(!card||!member)return;
  const meta=card.querySelector('.member-meta');
  if(meta){
    let phone=meta.querySelector('[data-vccf-contact-phone]');if(!phone){phone=document.createElement('div');phone.dataset.vccfContactPhone='1';phone.innerHTML='<span>Contact number</span><b class="vccf-member-contact-value"></b>';meta.appendChild(phone)}
    let email=meta.querySelector('[data-vccf-contact-email]');if(!email){email=document.createElement('div');email.dataset.vccfContactEmail='1';email.innerHTML='<span>Email</span><b class="vccf-member-contact-value"></b>';meta.appendChild(email)}
    phone.querySelector('b').innerHTML=singleContactMarkup('phone',member.contact_number);email.querySelector('b').innerHTML=singleContactMarkup('email',member.email);
  }
  const actions=document.querySelector('#members .member-detail-actions');if(!actions)return;
  let button=actions.querySelector('[data-vccf-edit-contact]');
  if(!canEdit(member)){button?.remove();return}
  if(!button){button=document.createElement('button');button.className='btn secondary';button.type='button';button.dataset.vccfEditContact='1';button.textContent='Edit contact';const editInfo=actions.querySelector('#editMemberInfo');if(editInfo)actions.insertBefore(button,editInfo);else actions.appendChild(button)}
  button.onclick=()=>openContactEditor(member);
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
async function run(){ensureStyles();await hydrate();patchMemberProfile();patchMemberEdit();patchAppShellProfile();patchLeadershipDirectory();patchLeadershipForm()}
function queue(){clearTimeout(timer);timer=setTimeout(()=>void run(),90)}
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);
document.addEventListener('click',event=>{const el=event.target.closest?.('[data-view-member],[data-member-id]');if(el){activeMemberId=el.dataset.viewMember||el.dataset.memberId||activeMemberId;queue()}},true);
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

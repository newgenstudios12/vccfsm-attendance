(() => {
'use strict';
if (window.__VCCF_MEMBERS_ADD_V1__) return;
window.__VCCF_MEMBERS_ADD_V1__ = true;

const state = () => window.VCCF?.getState?.() || {};
const client = () => window.VCCF?.sb;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role = () => String(state().profile?.role || '').toLowerCase().trim().replace(/\s+/g, '_');
const canAdd = () => ['admin','pastor','area_leader'].includes(role());
const memberName = m => m?.display_name || [m?.first_name,m?.last_name].filter(Boolean).join(' ') || m?.member_code || 'Member';
const areaName = id => (state().areas || []).find(a => a.id === id)?.name || 'Unassigned';

function notify(message, good=false) {
  document.getElementById('vccfMemberToast')?.remove();
  const el = document.createElement('div');
  el.id = 'vccfMemberToast';
  el.className = 'vccf-member-toast' + (good ? ' good' : '');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function activeAreaOptions(selected='') {
  return '<option value="">Unassigned</option>' + (state().areas || [])
    .filter(a => a.is_active !== false)
    .map(a => '<option value="'+esc(a.id)+'" '+(a.id===selected?'selected':'')+'>'+esc(a.name)+'</option>')
    .join('');
}

function closeModal() {
  document.getElementById('vccfMemberModal')?.remove();
}

function syncNewMember(member) {
  const s = state();
  if (member && Array.isArray(s.members) && !s.members.some(m => m.id === member.id)) {
    s.members.push(member);
    s.members.sort((a,b) => memberName(a).localeCompare(memberName(b)));
  }
  const search = document.getElementById('memberSearch');
  search?.dispatchEvent(new Event('input', {bubbles:true}));

  const total = document.getElementById('totalMembers');
  if (total) total.textContent = String((s.members || []).length);
  const active = document.getElementById('activeMembers');
  if (active) active.textContent = String((s.members || []).filter(m => m.is_active && String(m.status || '').toLowerCase() !== 'inactive').length);

  const memberSelect = document.getElementById('memberSelect');
  if (memberSelect && member?.is_active) {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = memberName(member) + ' — ' + (member.member_code || '');
    memberSelect.appendChild(option);
  }
}

function openAddMember() {
  if (!canAdd()) return;
  const s = state();
  const r = role();
  const isAreaLeader = r === 'area_leader';
  const leaderAreaId = s.profile?.area_id || '';
  if (isAreaLeader && !leaderAreaId) {
    notify('Your account has no assigned area. Ask an administrator to assign one first.');
    return;
  }

  closeModal();
  const wrap = document.createElement('div');
  wrap.id = 'vccfMemberModal';
  wrap.className = 'vccf-member-modal';
  const areaControl = isAreaLeader
    ? '<select id="vccfMemberArea" disabled><option value="'+esc(leaderAreaId)+'" selected>'+esc(areaName(leaderAreaId))+'</option></select><div class="vccf-member-help">Area Leaders can add members only to their assigned area.</div>'
    : '<select id="vccfMemberArea">'+activeAreaOptions('')+'</select>';
  const typeOptions = isAreaLeader
    ? '<option value="Member">Member</option><option value="Guest">Guest</option>'
    : '<option value="Member">Member</option><option value="Guest">Guest</option><option value="Area Leader">Area Leader</option><option value="Pastor">Pastor</option><option value="Admin">Admin</option>';

  wrap.innerHTML = '<div class="vccf-member-modal-card" role="dialog" aria-modal="true" aria-labelledby="vccfMemberModalTitle">'+
    '<div class="vccf-member-modal-head"><div><h2 id="vccfMemberModalTitle">Add Member</h2><div class="hint">Create a new VCCF member record.</div></div><button class="vccf-member-modal-close" type="button" aria-label="Close">×</button></div>'+
    '<form id="vccfMemberForm" class="vccf-member-form">'+
      '<div class="vccf-member-form-grid">'+
        '<div class="vccf-member-field"><label for="vccfMemberFirst">First name *</label><input id="vccfMemberFirst" name="first_name" autocomplete="given-name" required></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberLast">Last name *</label><input id="vccfMemberLast" name="last_name" autocomplete="family-name" required></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberDisplay">Display name</label><input id="vccfMemberDisplay" name="display_name" placeholder="Optional"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberArea">Area</label>'+areaControl+'</div>'+
        '<div class="vccf-member-field"><label for="vccfMemberType">Member type *</label><select id="vccfMemberType" name="member_type">'+typeOptions+'</select></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberCategory">Category</label><select id="vccfMemberCategory" name="member_category"><option value="">None</option><option value="Youth">Youth</option><option value="Couples">Couples</option></select></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberStatus">Status *</label><select id="vccfMemberStatus" name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberBirth">Birthday</label><input id="vccfMemberBirth" name="birth_date" type="date"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberContact">Contact number</label><input id="vccfMemberContact" name="contact_number" type="tel" autocomplete="tel"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberEmail">Email</label><input id="vccfMemberEmail" name="email" type="email" autocomplete="email"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberBarangay">Barangay</label><input id="vccfMemberBarangay" name="barangay"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberCity">City / Municipality</label><input id="vccfMemberCity" name="city_municipality" value="Santa Maria"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberProvince">Province</label><input id="vccfMemberProvince" name="province" value="Laguna"></div>'+
        '<div class="vccf-member-field"><label for="vccfMemberPhoto">Profile photo URL</label><input id="vccfMemberPhoto" name="photo_url" type="url" placeholder="Optional"></div>'+
        '<div class="vccf-member-field full"><label for="vccfMemberAddress">Address</label><textarea id="vccfMemberAddress" name="address" placeholder="Street / sitio / subdivision and other address details"></textarea></div>'+
      '</div>'+
      '<div class="vccf-member-form-actions"><button type="button" class="btn secondary" id="vccfMemberCancel">Cancel</button><button type="submit" class="btn" id="vccfMemberSave">Add Member</button></div>'+
      '<div id="vccfMemberFormMsg" class="vccf-member-form-msg" role="status"></div>'+
    '</form></div>';
  document.body.appendChild(wrap);

  const close = () => closeModal();
  wrap.querySelector('.vccf-member-modal-close').onclick = close;
  document.getElementById('vccfMemberCancel').onclick = close;
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', function escClose(e){ if(e.key==='Escape'){ document.removeEventListener('keydown',escClose); close(); } }, {once:true});
  setTimeout(() => document.getElementById('vccfMemberFirst')?.focus(), 30);

  document.getElementById('vccfMemberForm').onsubmit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const save = document.getElementById('vccfMemberSave');
    const msg = document.getElementById('vccfMemberFormMsg');
    const fd = new FormData(form);
    const first = String(fd.get('first_name') || '').trim();
    const last = String(fd.get('last_name') || '').trim();
    if (!first || !last) return;

    const status = String(fd.get('status') || 'active');
    const areaId = isAreaLeader ? leaderAreaId : (document.getElementById('vccfMemberArea')?.value || null);
    const payload = {
      first_name:first,
      last_name:last,
      display_name:String(fd.get('display_name') || '').trim() || null,
      area_id:areaId || null,
      member_type:String(fd.get('member_type') || 'Member'),
      member_category:String(fd.get('member_category') || '').trim() || null,
      status,
      is_active:status === 'active',
      birth_date:String(fd.get('birth_date') || '').trim() || null,
      contact_number:String(fd.get('contact_number') || '').trim() || null,
      email:String(fd.get('email') || '').trim() || null,
      barangay:String(fd.get('barangay') || '').trim() || null,
      city_municipality:String(fd.get('city_municipality') || '').trim() || null,
      province:String(fd.get('province') || '').trim() || null,
      photo_url:String(fd.get('photo_url') || '').trim() || null,
      address:String(fd.get('address') || '').trim()
    };

    save.disabled = true;
    save.textContent = 'Saving…';
    msg.textContent = '';
    msg.style.color = '';
    try {
      const db = client();
      if (!db) throw new Error('Database connection is unavailable.');
      const {data,error} = await db.from('members').insert(payload).select('id,member_code,first_name,last_name,display_name,area_id,is_active,status,member_type,member_category,address,province,city_municipality,barangay,birth_date,photo_url,contact_number,email,created_at').single();
      if (error) throw error;
      syncNewMember(data);
      closeModal();
      notify(memberName(data) + ' was added successfully.', true);
    } catch (err) {
      console.error('Add member:', err);
      msg.textContent = err?.message || 'Unable to add member.';
      msg.style.color = '#b42318';
      save.disabled = false;
      save.textContent = 'Add Member';
    }
  };
}

function install() {
  const toolbar = document.querySelector('#members .toolbar');
  if (!toolbar) return;
  let button = document.getElementById('vccfAddMemberBtn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'vccfAddMemberBtn';
    button.className = 'btn vccf-member-add-btn';
    button.type = 'button';
    button.textContent = '+ Add Member';
    button.addEventListener('click', openAddMember);
    toolbar.appendChild(button);
  }
  button.classList.toggle('hidden', !canAdd());
  if (role() === 'area_leader') button.title = 'Add a member to ' + areaName(state().profile?.area_id);
  else button.removeAttribute('title');
}

window.addEventListener('vccf-app-ready', install);
window.addEventListener('vccf-profile-updated', install);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
else install();
setTimeout(install, 800);
})();
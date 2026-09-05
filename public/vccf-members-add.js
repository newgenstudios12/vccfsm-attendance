(() => {
'use strict';
if (window.__VCCF_MEMBERS_ADD_V3__) return;
window.__VCCF_MEMBERS_ADD_V3__ = true;

const state = () => window.VCCF?.getState?.() || {};
const client = () => window.VCCF?.sb;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role = () => String(state().profile?.role || '').toLowerCase().trim().replace(/\s+/g, '_');
const canAdd = () => ['admin','pastor','area_leader'].includes(role());
const memberName = m => m?.display_name || [m?.first_name,m?.last_name].filter(Boolean).join(' ') || m?.member_code || 'Member';
const areaName = id => (state().areas || []).find(a => a.id === id)?.name || 'Unassigned';

if (!state().session?.user || !client()) {
  console.warn('Add Member skipped: authenticated app state is not ready.');
  return;
}

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

function profilePhotoFromFile(file) {
  if (!file) return Promise.resolve(null);
  if (!String(file.type || '').startsWith('image/')) return Promise.reject(new Error('Profile picture must be an image.'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Profile picture must be 5 MB or smaller.'));
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected profile picture.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Unable to process the selected profile picture.'));
      image.onload = () => {
        try {
          const max = 640;
          const scale = Math.min(1, max / Math.max(image.width || 1, image.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Image processing is unavailable on this device.');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .82));
        } catch (error) {
          reject(error);
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function closeModal() {
  const modal = document.getElementById('vccfMemberModal');
  if (!modal) return;
  const handler = modal.__vccfEscapeHandler;
  if (handler) document.removeEventListener('keydown', handler);
  if (modal.__vccfPhotoObjectUrl) {
    try { URL.revokeObjectURL(modal.__vccfPhotoObjectUrl); } catch (_) {}
  }
  modal.remove();
}

function syncNewMember(member) {
  const s = state();
  if (member && Array.isArray(s.members) && !s.members.some(m => m.id === member.id)) {
    s.members.push(member);
    s.members.sort((a,b) => memberName(a).localeCompare(memberName(b)));
  }
  document.getElementById('memberSearch')?.dispatchEvent(new Event('input', {bubbles:true}));
  const total = document.getElementById('totalMembers');
  if (total) total.textContent = String((s.members || []).length);
  const active = document.getElementById('activeMembers');
  if (active) active.textContent = String((s.members || []).filter(m => m.is_active && String(m.status || '').toLowerCase() !== 'inactive').length);
  const memberSelect = document.getElementById('memberSelect');
  if (memberSelect && member?.is_active && !memberSelect.querySelector('option[value="'+CSS.escape(member.id)+'"]')) {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = memberName(member) + ' — ' + (member.member_code || '');
    memberSelect.appendChild(option);
  }
  if (document.getElementById('richMemberTable')) {
    setTimeout(() => document.querySelector('[data-route="members"]')?.click(), 0);
  }
}

function openAddMember() {
  const s = state();
  if (!s.session?.user || !canAdd()) return;
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
    '<div class="vccf-member-modal-head"><div><h2 id="vccfMemberModalTitle">Add Member</h2><div class="hint">Create a member record only. Login account creation is handled separately.</div></div><button class="vccf-member-modal-close" type="button" aria-label="Close">×</button></div>'+
    '<form id="vccfMemberForm" class="vccf-member-form">'+
      '<div class="vccf-member-form-grid">'+
        '<div class="vccf-member-field full"><label for="vccfMemberPhotoFile">Profile picture</label><div class="vccf-member-photo-upload"><div class="vccf-member-photo-preview" id="vccfMemberPhotoPreview" aria-hidden="true"><span>Photo</span></div><div class="vccf-member-photo-picker"><input id="vccfMemberPhotoFile" name="photo_file" type="file" accept="image/*"><div class="vccf-member-help">Choose a photo from your library or take a new one. Images are resized automatically. Maximum 5 MB.</div></div></div></div>'+
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
  const escClose = e => { if(e.key === 'Escape') close(); };
  wrap.__vccfEscapeHandler = escClose;
  document.addEventListener('keydown', escClose);

  const photoInput = document.getElementById('vccfMemberPhotoFile');
  const photoPreview = document.getElementById('vccfMemberPhotoPreview');
  photoInput.onchange = () => {
    const file = photoInput.files?.[0];
    if (wrap.__vccfPhotoObjectUrl) {
      try { URL.revokeObjectURL(wrap.__vccfPhotoObjectUrl); } catch (_) {}
      wrap.__vccfPhotoObjectUrl = null;
    }
    if (!file) {
      photoPreview.innerHTML = '<span>Photo</span>';
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      notify('Please choose an image for the profile picture.');
      photoInput.value = '';
      photoPreview.innerHTML = '<span>Photo</span>';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Profile picture must be 5 MB or smaller.');
      photoInput.value = '';
      photoPreview.innerHTML = '<span>Photo</span>';
      return;
    }
    wrap.__vccfPhotoObjectUrl = URL.createObjectURL(file);
    photoPreview.innerHTML = '<img src="'+esc(wrap.__vccfPhotoObjectUrl)+'" alt="Selected profile picture preview">';
  };

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
      photo_url:null,
      address:String(fd.get('address') || '').trim()
    };

    save.disabled = true;
    save.textContent = 'Saving…';
    msg.textContent = '';
    try {
      const selectedPhoto = photoInput.files?.[0] || null;
      if (selectedPhoto) {
        save.textContent = 'Preparing photo…';
        payload.photo_url = await profilePhotoFromFile(selectedPhoto);
        save.textContent = 'Saving…';
      }
      const db = client();
      if (!state().session?.user || !db) throw new Error('Your session is no longer active. Sign in again and retry.');
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
  try {
    const s = state();
    if (!s.session?.user || !client()) return;
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
    if (role() === 'area_leader') button.title = 'Add a member to ' + areaName(s.profile?.area_id);
    else button.removeAttribute('title');
  } catch (error) {
    console.error('Add Member failed to initialize:', error);
  }
}

window.addEventListener('vccf-profile-updated', install);
window.addEventListener('vccf-members-add-activate', install);
install();
})();

(() => {
'use strict';
if (window.VCCFMemberIds) return;

const state = () => window.VCCF?.getState?.() || {};
const client = () => window.VCCF?.sb;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const name = member => member.display_name || [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Member';
const number = member => member.member_number || 'Not assigned';
const canManage = profile => ['admin', 'pastor'].includes(String(profile?.role || '').toLowerCase());
const labels = {pending:'Pending', printing:'Printing', ready:'Ready for pickup', collected:'Collected', declined:'Declined', cancelled:'Cancelled'};
const nextStatus = {pending:['printing','declined','cancelled'], printing:['ready','cancelled'], ready:['collected','cancelled'], collected:[], declined:[], cancelled:[]};
const openStatuses = ['pending', 'printing', 'ready'];
const date = value => value ? new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila', month:'short', day:'numeric', year:'numeric'}).format(new Date(value)) : '—';
const birthday = value => value ? date(String(value) + 'T12:00:00+08:00') : 'Not recorded';
const area = member => member.areas?.name || (state().areas || []).find(item => item.id === member.area_id)?.name || 'No designated area';
const memberFields = 'id,member_number,member_code,first_name,last_name,display_name,member_type,area_id,photo_url,birth_date,address,barangay,city_municipality,province,contact_number,email,updated_at,areas(name)';
const requestFields = 'id,member_id,requested_by,status,request_notes,admin_notes,created_at,updated_at';

let root = null;
let mode = 'self';
let selectedId = null;
let loadedMember = null;
let loadedProfile = null;
let requests = [];
let generation = 0;
let inFlight = null;
let signature = '';
let draftNotes = '';
let queueFilter = 'open';
let feedback = '';

function active() {
  return root?.isConnected && root.classList.contains('active') && !!state().session?.user?.id;
}
function message(text, error = false) {
  const target = root?.querySelector('[data-id-feedback]');
  if (target) {
    target.textContent = text;
    target.classList.toggle('id-error', error);
  }
}
function personalDetails(member) {
  return [
    ['Member number', number(member)],
    ['Area', area(member)],
    ['Birthday', birthday(member.birth_date)],
    ['Address', member.address || [member.barangay, member.city_municipality, member.province].filter(Boolean).join(', ') || 'Not recorded'],
    ['Contact number', member.contact_number || 'Not recorded'],
    ['Email', member.email || 'Not recorded']
  ].map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
}
function cardMarkup(member, photo) {
  const initials = name(member).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return `<article class="id-card" aria-label="Digital member ID">
    <header class="id-card-brand"><img src="/vccf-logo-white.png" alt="Victorious Cross Christian Fellowship Santa Maria"><span>Santa Maria</span></header>
    <div class="id-card-main">
      <span class="id-card-label">MEMBER ID</span>
      <div class="id-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(name(member))}">` : `<span aria-label="Profile picture not uploaded">${esc(initials)}</span>`}</div>
      <h2>${esc(name(member))}</h2>
      <p class="id-number">${esc(number(member))}</p>
      <p class="id-type">${esc(member.member_type || 'Member')}</p>
      <p class="id-area">${esc(area(member))}</p>
      <div class="id-qr" data-digital-id-qr aria-label="Member attendance QR code"></div>
    </div>
    <footer>Victorious Cross Christian Fellowship<br>Santa Maria</footer>
  </article>`;
}
function requestMarkup(own) {
  if (!own) return '';
  const current = requests.find(item => openStatuses.includes(item.status));
  return `<section class="id-panel">
    <h2>Physical ID</h2>
    ${current ? `<div class="id-current-request"><span class="id-badge id-${esc(current.status)}">${labels[current.status]}</span><p>${current.status === 'ready' ? 'Your ID is ready. Please coordinate with the church office for pickup.' : current.status === 'printing' ? 'Your physical ID is being prepared.' : 'Your request has been submitted for review.'}</p>${current.admin_notes ? `<p>${esc(current.admin_notes)}</p>` : ''}${current.status === 'pending' ? `<button type="button" class="btn secondary" data-cancel-id-request="${esc(current.id)}">Cancel request</button>` : ''}</div>` : `<form data-id-request-form><label for="physicalIdNotes">Notes (optional)</label><textarea id="physicalIdNotes" name="notes" rows="2" maxlength="1000" placeholder="Add any details for the church office">${esc(draftNotes)}</textarea><button type="submit" class="btn">Request for physical ID</button></form>`}
    <div data-id-feedback role="status" aria-live="polite">${esc(feedback)}</div>
    ${requests.length ? `<details class="id-history"><summary>Request history</summary>${requests.map(item => `<div class="id-history-row"><div><span class="id-badge id-${esc(item.status)}">${labels[item.status]}</span><span class="id-date">${esc(date(item.created_at))}</span></div>${item.request_notes ? `<p>${esc(item.request_notes)}</p>` : ''}${item.admin_notes && item.id !== current?.id ? `<p>${esc(item.admin_notes)}</p>` : ''}</div>`).join('')}</details>` : ''}
  </section>`;
}
function renderSelf() {
  if (!root) return;
  if (!loadedMember) {
    root.innerHTML = '<section class="id-panel"><h2>Digital ID</h2><p>Your account needs a linked member record before an ID can be shown. Ask an administrator to link your account to your member profile.</p><div data-id-feedback role="status"></div></section>';
    return;
  }
  const own = loadedMember.id === loadedProfile?.member_id;
  const photo = loadedMember.photo_url || (own ? loadedProfile.profile_photo_url : '') || '';
  root.innerHTML = `<div class="id-layout"><div>${cardMarkup(loadedMember, photo)}<p class="id-live-note">Your Digital ID follows your saved member information. Your member number stays the same.</p></div><div class="id-side"><section class="id-panel"><h2>Personal details</h2><dl class="id-details">${personalDetails(loadedMember)}</dl></section>${requestMarkup(own)}${!own ? '<div data-id-feedback role="status" aria-live="polite"></div>' : ''}</div></div>`;
  const qr = root.querySelector('[data-digital-id-qr]');
  if (window.QRCode && loadedMember.member_number) {
    new window.QRCode(qr, {text:'VCCF-MEMBER:' + loadedMember.member_number, width:152, height:152, colorDark:'#111111', colorLight:'#ffffff', correctLevel:window.QRCode.CorrectLevel.H});
  } else {
    qr.textContent = 'QR unavailable. Use your member number for attendance.';
  }
  const form = root.querySelector('[data-id-request-form]');
  if (form) {
    form.elements.notes.addEventListener('input', event => { draftNotes = event.target.value; });
    form.addEventListener('submit', submitRequest);
  }
  root.querySelector('[data-cancel-id-request]')?.addEventListener('click', cancelRequest);
}
async function submitRequest(event) {
  event.preventDefault();
  const member = loadedMember;
  const uid = state().session?.user?.id;
  if (!member || member.id !== loadedProfile?.member_id || !uid) return;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Submitting…';
  try {
    const {error} = await client().from('member_id_requests').insert({member_id:member.id, requested_by:uid, request_notes:draftNotes.trim()});
    if (error) throw error;
    draftNotes = '';
    feedback = 'Physical ID request submitted.';
    await refresh(true);
  } catch (error) {
    if (error.code === '23505') {
      feedback = 'An ID request is already open for this member.';
      await refresh(true);
    } else message(error.message || 'Unable to submit your request. Please try again.', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Request for physical ID';
  }
}
async function cancelRequest(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const {data, error} = await client().from('member_id_requests').update({status:'cancelled'}).eq('id', button.dataset.cancelIdRequest).eq('status', 'pending').select('id').maybeSingle();
    if (error) throw error;
    feedback = data ? 'ID request cancelled.' : 'This request has changed. Its latest status is shown below.';
    await refresh(true);
  } catch (error) { message(error.message || 'Unable to cancel the request.', true); }
  finally { button.disabled = false; }
}
function renderQueue() {
  const visible = queueFilter === 'open' ? requests.filter(item => openStatuses.includes(item.status)) : queueFilter === 'all' ? requests : requests.filter(item => item.status === queueFilter);
  root.innerHTML = `<section class="id-panel"><div class="id-queue-head"><div><h2>Physical ID requests</h2><p>Use the member’s latest information when preparing their ID.</p></div><a class="btn secondary" href="https://canva.link/1efsdjt75n44vin" target="_blank" rel="noopener noreferrer">Open ID template</a></div><label class="id-filter">Show requests<select data-id-filter>${[['open','Open requests'],['all','All requests'],...Object.entries(labels)].map(([key, label]) => `<option value="${key}" ${queueFilter === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div data-id-feedback role="status" aria-live="polite">${esc(feedback)}</div><div class="id-request-list">${visible.length ? visible.map(item => {
    const member = item.member;
    return `<article class="id-request-row"><div class="id-request-identity"><h3>${esc(member ? name(member) : 'Member record unavailable')}</h3><b class="id-number">${esc(member ? number(member) : '—')}</b><span>${esc(member ? area(member) : '')}</span><span class="id-date">Requested ${esc(date(item.created_at))}</span><span class="id-badge id-${esc(item.status)}">${labels[item.status]}</span>${item.request_notes ? `<p>${esc(item.request_notes)}</p>` : ''}${member ? `<button type="button" class="btn secondary" data-view-id-member="${esc(member.id)}">View Digital ID</button>` : ''}</div><form data-id-review-form data-request-id="${esc(item.id)}" data-old-status="${esc(item.status)}"><label>Status<select name="status">${[item.status, ...nextStatus[item.status]].map(status => `<option value="${status}">${labels[status]}</option>`).join('')}</select></label><label>Note for the member<textarea name="admin_notes" rows="2" maxlength="1000">${esc(item.admin_notes)}</textarea></label><button type="submit" class="btn">Save update</button><div data-review-feedback role="status"></div></form></article>`;
  }).join('') : '<p class="empty">No ID requests in this view.</p>'}</div>${requests.length === 200 ? '<p class="id-live-note">Showing the latest 200 requests.</p>' : ''}</section>`;
  root.querySelector('[data-id-filter]').addEventListener('change', event => { queueFilter = event.target.value; void refresh(true); });
  root.querySelectorAll('[data-id-review-form]').forEach(form => form.addEventListener('submit', reviewRequest));
  root.querySelectorAll('[data-view-id-member]').forEach(button => button.addEventListener('click', () => openMember(button.dataset.viewIdMember)));
}
async function reviewRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const output = form.querySelector('[data-review-feedback]');
  button.disabled = true;
  output.textContent = 'Saving…';
  try {
    const {data, error} = await client().from('member_id_requests').update({status:form.elements.status.value, admin_notes:form.elements.admin_notes.value.trim()}).eq('id', form.dataset.requestId).eq('status', form.dataset.oldStatus).select('id').maybeSingle();
    if (error) throw error;
    feedback = data ? 'ID request updated.' : 'This request was updated by someone else. Review its latest status.';
    await refresh(true);
  } catch (error) { output.textContent = error.message || 'Unable to update the request.'; }
  finally { button.disabled = false; }
}
async function fetchSelf(epoch) {
  const uid = state().session?.user?.id;
  const {data:profile, error:profileError} = await client().from('profiles').select('user_id,member_id,role,profile_photo_url').eq('user_id', uid).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw Object.assign(new Error('Your account profile could not be loaded.'), {clearId:true});
  const id = selectedId || profile.member_id;
  let member = null;
  let history = [];
  if (id) {
    const {data, error} = await client().from('members').select(memberFields).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error('This member ID is unavailable to your account.'), {clearId:true});
    member = data;
    if (id === profile.member_id) {
      const {data:rows, error:requestError} = await client().from('member_id_requests').select(requestFields).eq('member_id', id).eq('requested_by', uid).order('created_at', {ascending:false}).limit(20);
      if (requestError) throw requestError;
      history = rows || [];
    }
  }
  if (epoch !== generation) return null;
  loadedProfile = profile;
  loadedMember = member;
  requests = history;
  return JSON.stringify({member, profile, history});
}
async function fetchQueue(epoch) {
  const uid = state().session?.user?.id;
  const {data:profile, error:profileError} = await client().from('profiles').select('role').eq('user_id', uid).maybeSingle();
  if (profileError) throw profileError;
  if (!canManage(profile)) throw new Error('Only admins and pastors can manage physical ID requests.');
  let query = client().from('member_id_requests').select(`${requestFields},member:members(${memberFields})`).order('created_at', {ascending:false}).limit(200);
  if (queueFilter === 'open') query = query.in('status', openStatuses);
  else if (queueFilter !== 'all') query = query.eq('status', queueFilter);
  const {data, error} = await query;
  if (error) throw error;
  if (epoch !== generation) return null;
  requests = data || [];
  return JSON.stringify(requests);
}
async function refresh(force = false) {
  if (!active() || document.hidden) return;
  // Do not interrupt a request note or an admin review while it is being edited.
  if (!force && root.contains(document.activeElement) && document.activeElement?.closest('form')) return;
  if (inFlight?.epoch === generation) {
    await inFlight.promise;
    if (force && active()) return refresh(true);
    return;
  }
  const epoch = generation;
  const task = (async () => {
    try {
      const fresh = await (mode === 'queue' ? fetchQueue(epoch) : fetchSelf(epoch));
      if (epoch !== generation || !active() || fresh === null) return;
      if (force || fresh !== signature) {
        signature = fresh;
        mode === 'queue' ? renderQueue() : renderSelf();
      }
    } catch (error) {
      if (epoch !== generation || !active()) return;
      if (error.clearId) { signature = ''; loadedMember = loadedProfile = null; }
      if (!signature) root.innerHTML = '<section class="id-panel"><h2>Member ID unavailable</h2><div data-id-feedback role="status"></div><button type="button" class="btn secondary" data-id-retry>Try again</button></section>';
      message(error.message || 'Unable to refresh your ID. Please try again.', true);
      root.querySelector('[data-id-retry]')?.addEventListener('click', () => refresh(true), {once:true});
    }
  })();
  inFlight = {epoch, promise:task};
  await task;
  if (inFlight?.promise === task) inFlight = null;
}
function mount(target, memberId = null) {
  generation++;
  root = target;
  mode = 'self';
  selectedId = memberId;
  loadedMember = null;
  signature = '';
  draftNotes = '';
  feedback = '';
  root.innerHTML = '<section class="id-panel" role="status">Loading Digital ID…</section>';
  void refresh(true);
}
function mountRequests(target) {
  generation++;
  root = target;
  mode = 'queue';
  selectedId = null;
  signature = '';
  feedback = '';
  root.innerHTML = '<section class="id-panel" role="status">Loading ID requests…</section>';
  void refresh(true);
}
function openMember(id) {
  window.dispatchEvent(new CustomEvent('vccf-open-member-id', {detail:{memberId:id}}));
}
window.VCCFMemberIds = {mount, mountRequests, openMember, refresh};
['vccf-profile-photo-updated','vccf-member-updated','vccf-member-contact-updated','vccf-profile-linked'].forEach(event => window.addEventListener(event, () => { void refresh(true); }));
window.addEventListener('focus', () => { void refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
// Poll only the visible ID page so changes saved on another device also appear.
setInterval(() => { void refresh(); }, 30000);
window.addEventListener('vccf-signed-out', () => {
  generation++;
  root = null;
  selectedId = loadedMember = loadedProfile = null;
  requests = [];
  signature = draftNotes = feedback = '';
});
})();

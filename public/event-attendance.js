(() => {
'use strict';
if (window.__VCCF_EVENT_ATTENDANCE__) return;
window.__VCCF_EVENT_ATTENDANCE__ = true;

let root = null;
let events = [];
let registrations = [];
let scanner = null;
let scanBusy = false;
let selectedEventId = null;

const app = () => window.VCCF;
const state = () => app()?.getState?.() || {};
const sb = () => app()?.sb;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const memberName = member => member?.display_name || [member?.first_name,member?.last_name].filter(Boolean).join(' ') || member?.member_code || 'Member';
const memberById = id => (state().members || []).find(member => member.id === id);
const areaName = id => (state().areas || []).find(area => area.id === id)?.name || 'Unassigned';
const modeOf = event => event?.participation_mode || (event?.registration_required ? 'registration_required' : 'registration_optional');
const modeLabel = event => ({registration_required:'Registration required',registration_optional:'Registration optional',attendance_only:'Attendance only'})[modeOf(event)] || 'Registration optional';
const fmtDateTime = value => value ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)) : '—';
const fmtShortDate = value => value ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(value)) : '—';
const currentUserId = () => state().session?.user?.id || null;
const isCheckedIn = registration => registration?.status === 'Attended' || Boolean(registration?.checked_in_at);
const statusBadge = (text, kind='') => '<span class="cms-badge '+kind+'">'+esc(text)+'</span>';
const empty = text => '<div class="cms-empty">'+esc(text)+'</div>';

function participation(event) {
  const rows = registrations.filter(registration => registration.event_id === event.id && registration.status !== 'Cancelled');
  const attended = rows.filter(isCheckedIn).length;
  if (modeOf(event) === 'attendance_only') return {rows,attended,summary:attended+' attendees'};
  return {rows,attended,summary:attended+' / '+rows.length+' attended'};
}

async function mount(container) {
  root = container;
  selectedEventId = null;
  root.innerHTML = '<section class="cms-panel card"><div class="loading">Loading event attendance…</div></section>';
  const client = sb();
  if (!client) {
    root.innerHTML = '<section class="cms-panel card"><div class="notice">The attendance service is not available.</div></section>';
    return;
  }
  const [eventResult,registrationResult] = await Promise.all([
    client.from('church_events').select('*').order('start_at',{ascending:false}).limit(300),
    client.from('church_event_registrations').select('*').order('registered_at',{ascending:false}).limit(2000)
  ]);
  if (!root || !document.body.contains(root)) return;
  if (eventResult.error || registrationResult.error) {
    const message = eventResult.error?.message || registrationResult.error?.message || 'Unable to load event attendance.';
    root.innerHTML = '<section class="cms-panel card"><div class="notice">'+esc(message)+'</div></section>';
    return;
  }
  events = eventResult.data || [];
  registrations = registrationResult.data || [];
  renderEventList();
}

function renderEventList() {
  if (!root) return;
  root.innerHTML = '<section class="cms-panel card"><div class="cms-panel-head"><div><span class="cms-kicker">EVENT ATTENDANCE</span><h3>Select an event</h3><p>Open an event to scan member QR codes, record walk-ins, and review its attendance.</p></div><button id="refreshEventAttendance" class="btn secondary" type="button">Refresh</button></div><div class="event-attendance-toolbar"><input id="eventAttendanceSearch" type="search" placeholder="Search event or location…"><select id="eventAttendanceStatus"><option value="">All statuses</option><option>Scheduled</option><option>Ongoing</option><option>Completed</option><option>Cancelled</option></select></div><div id="eventAttendanceList"></div></section>';
  const render = () => {
    const query = document.getElementById('eventAttendanceSearch')?.value.trim().toLowerCase() || '';
    const status = document.getElementById('eventAttendanceStatus')?.value || '';
    const filtered = events.filter(event => (!query || (event.title+' '+(event.location || '')+' '+(event.event_type || '')).toLowerCase().includes(query)) && (!status || event.status === status));
    const list = document.getElementById('eventAttendanceList');
    if (!list) return;
    list.innerHTML = filtered.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Date</th><th>Participation</th><th>Attendance</th><th>Status</th><th></th></tr></thead><tbody>'+filtered.map(event => {
      const stats = participation(event);
      return '<tr><td><b>'+esc(event.title)+'</b><div class="cms-sub">'+esc(event.event_type || 'Event')+' · '+esc(event.location || 'Location not set')+'</div></td><td>'+esc(fmtShortDate(event.start_at))+'</td><td>'+statusBadge(modeLabel(event),modeOf(event)==='attendance_only'?'ok':'')+'</td><td><b>'+esc(stats.summary)+'</b></td><td>'+statusBadge(event.status || 'Scheduled',event.status==='Completed'?'ok':'')+'</td><td><button class="cms-small" type="button" data-open-event-attendance="'+esc(event.id)+'">Open attendance</button></td></tr>';
    }).join('')+'</tbody></table></div>' : empty('No events match these filters.');
    list.querySelectorAll('[data-open-event-attendance]').forEach(button => button.onclick = () => renderEventDetail(button.dataset.openEventAttendance));
  };
  document.getElementById('eventAttendanceSearch').oninput = render;
  document.getElementById('eventAttendanceStatus').onchange = render;
  document.getElementById('refreshEventAttendance').onclick = () => mount(root);
  render();
}

function memberOptions(eventId, query='') {
  const normalized = String(query).trim().toLowerCase();
  const registered = new Set(registrations.filter(row => row.event_id === eventId && row.status !== 'Cancelled').map(row => row.member_id));
  return (state().members || []).filter(member => member.is_active !== false && String(member.status || '').toLowerCase() !== 'inactive' && (!normalized || (memberName(member)+' '+(member.member_code || '')).toLowerCase().includes(normalized))).slice().sort((a,b) => memberName(a).localeCompare(memberName(b))).slice(0,150).map(member => '<option value="'+esc(member.id)+'">'+esc(memberName(member))+' — '+esc(member.member_code || areaName(member.area_id))+(registered.has(member.id)?' · On roster':'')+'</option>').join('');
}

function renderEventDetail(eventId) {
  if (!root) return;
  selectedEventId = eventId;
  const event = events.find(item => item.id === eventId);
  if (!event) { renderEventList(); return; }
  const mode = modeOf(event);
  const attendanceOnly = mode === 'attendance_only';
  const rows = registrations.filter(row => row.event_id === eventId && row.status !== 'Cancelled');
  const attended = rows.filter(isCheckedIn);
  const attendanceRate = rows.length ? Math.round(attended.length / rows.length * 100) : 0;
  const displayRows = attendanceOnly ? attended : rows;
  root.innerHTML = '<div class="event-attendance-head"><button id="backToEventAttendance" class="cms-small" type="button">← All events</button><button id="exportEventAttendance" class="btn secondary" type="button">Export CSV</button></div><section class="cms-panel card"><div class="cms-panel-head"><div><span class="cms-kicker">EVENT ATTENDANCE</span><h3>'+esc(event.title)+'</h3><p>'+esc(fmtDateTime(event.start_at))+' · '+esc(event.location || 'Location not set')+'</p></div>'+statusBadge(modeLabel(event),attendanceOnly?'ok':'')+'</div><div class="event-attendance-stats '+(attendanceOnly?'attendance-only':'')+'">'+(attendanceOnly?'<div><span>Total attendees</span><strong>'+attended.length+'</strong></div><div><span>Registration</span><strong>Not required</strong></div>':'<div><span>Roster</span><strong>'+rows.length+'</strong></div><div><span>Attended</span><strong>'+attended.length+'</strong></div><div><span>Attendance rate</span><strong>'+attendanceRate+'%</strong></div><div><span>Not checked in</span><strong>'+Math.max(0,rows.length-attended.length)+'</strong></div>')+'</div><div class="cms-info">'+(attendanceOnly?'This event accepts direct attendance with no registration. ':'Walk-ins can be checked in even when they are not on the roster. ')+'Event attendance is separate from Sunday attendance performance.</div></section><div class="event-checkin-grid"><section class="cms-panel card"><div class="cms-panel-head"><div><h3>Scan member QR</h3><p>Scan the QR shown on the member profile.</p></div></div><div id="eventAttendanceReader" class="event-scanner"><span>Camera is off</span></div><div class="cms-actions event-scan-actions"><button id="startEventAttendanceScanner" class="btn" type="button">Start camera</button><button id="stopEventAttendanceScanner" class="btn secondary" type="button" disabled>Stop</button></div><div id="eventScannerStatus" class="event-checkin-status" role="status"></div></section><section class="cms-panel card"><div class="cms-panel-head"><div><h3>Manual check-in</h3><p>Search accessible members and record attendance.</p></div></div><label class="event-member-search">Search member<input id="eventAttendanceMemberSearch" placeholder="Search name or member code…"></label><label class="event-member-search">Member<select id="eventAttendanceMemberSelect"><option value="">Select a member</option>'+memberOptions(eventId)+'</select></label><button id="eventManualCheckin" class="btn" type="button">Check in member</button><div id="eventManualStatus" class="event-checkin-status" role="status"></div></section></div><section class="cms-panel card"><div class="cms-panel-head"><div><h3>'+(attendanceOnly?'Event Attendees':'Event Roster')+'</h3><p>'+(attendanceOnly?'Members who attended this event.':'Registration and check-in status for this event.')+'</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Area</th><th>Status</th><th>Check-in</th><th>Source</th><th></th></tr></thead><tbody>'+(displayRows.length ? displayRows.map(row => {
    const member = memberById(row.member_id);
    const checked = isCheckedIn(row);
    return '<tr><td><b>'+esc(memberName(member))+'</b><div class="cms-sub">'+esc(member?.member_code || '')+'</div></td><td>'+esc(areaName(member?.area_id))+'</td><td>'+statusBadge(checked?'Attended':row.status,checked?'ok':'')+'</td><td>'+esc(fmtDateTime(row.checked_in_at))+'</td><td>'+esc(row.check_in_source || '—')+'</td><td><button class="cms-small '+(checked?'danger-text':'')+'" type="button" data-toggle-event-attendance="'+esc(row.id)+'">'+(checked?'Undo check-in':'Check in')+'</button></td></tr>';
  }).join('') : '<tr><td colspan="6">'+empty(attendanceOnly?'No attendees have checked in yet.':'No registrations yet. Walk-ins can still be checked in above.')+'</td></tr>')+'</tbody></table></div></section>';

  document.getElementById('backToEventAttendance').onclick = async () => { await stopScanner(); renderEventList(); };
  document.getElementById('exportEventAttendance').onclick = () => exportCsv(event,rows);
  document.getElementById('startEventAttendanceScanner').onclick = () => startScanner(eventId);
  document.getElementById('stopEventAttendanceScanner').onclick = stopScanner;
  const search = document.getElementById('eventAttendanceMemberSearch');
  const select = document.getElementById('eventAttendanceMemberSelect');
  search.oninput = () => { select.innerHTML = '<option value="">Select a member</option>'+memberOptions(eventId,search.value); };
  document.getElementById('eventManualCheckin').onclick = eventClick => {
    if (!select.value) { setStatus('eventManualStatus','Select a member first.','error'); return; }
    checkIn(eventId,select.value,'manual',eventClick.currentTarget,'eventManualStatus');
  };
  root.querySelectorAll('[data-toggle-event-attendance]').forEach(button => button.onclick = () => toggleAttendance(button.dataset.toggleEventAttendance,eventId));
}

function setStatus(id, message, kind='') {
  const element = document.getElementById(id);
  if (!element) return;
  element.className = 'event-checkin-status '+kind;
  element.textContent = message;
}

function memberFromQr(raw) {
  const code = String(raw || '').trim().replace(/^VCCF-MEMBER:/i,'');
  return (state().members || []).find(member => String(member.member_code || '') === code || String(member.id) === code);
}

async function checkIn(eventId, memberId, source, button, statusId) {
  const member = memberById(memberId);
  if (!member) { setStatus(statusId,'QR does not match an accessible member.','error'); return; }
  const oldText = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  setStatus(statusId,'Recording event attendance…');
  try {
    const existing = registrations.find(row => row.event_id === eventId && row.member_id === memberId && row.status !== 'Cancelled');
    if (existing && isCheckedIn(existing)) { setStatus(statusId,memberName(member)+' is already checked in.','warning'); return; }
    const values = {status:'Attended',checked_in_at:new Date().toISOString(),checked_in_by:currentUserId(),check_in_source:source};
    const result = existing
      ? await sb().from('church_event_registrations').update(values).eq('id',existing.id).select().single()
      : await sb().from('church_event_registrations').insert({event_id:eventId,member_id:memberId,...values}).select().single();
    if (result.error) throw result.error;
    registrations = existing ? registrations.map(row => row.id === result.data.id ? result.data : row) : [result.data,...registrations];
    await stopScanner();
    renderEventDetail(eventId);
  } catch (error) {
    setStatus(statusId,error.message || 'Unable to check in.','error');
  } finally {
    if (button && document.body.contains(button)) { button.disabled = false; button.textContent = oldText; }
  }
}

async function toggleAttendance(registrationId,eventId) {
  const registration = registrations.find(row => row.id === registrationId);
  const event = events.find(item => item.id === eventId);
  if (!registration || !event) return;
  const checked = isCheckedIn(registration);
  if (checked && !confirm('Undo this event check-in?')) return;
  if (checked && modeOf(event) === 'attendance_only') {
    const result = await sb().from('church_event_registrations').delete().eq('id',registrationId);
    if (result.error) { alert(result.error.message); return; }
    registrations = registrations.filter(row => row.id !== registrationId);
  } else {
    const values = checked ? {status:'Registered',checked_in_at:null,checked_in_by:null,check_in_source:null} : {status:'Attended',checked_in_at:new Date().toISOString(),checked_in_by:currentUserId(),check_in_source:'manual'};
    const result = await sb().from('church_event_registrations').update(values).eq('id',registrationId).select().single();
    if (result.error) { alert(result.error.message); return; }
    registrations = registrations.map(row => row.id === registrationId ? result.data : row);
  }
  renderEventDetail(eventId);
}

async function startScanner(eventId) {
  if (!window.Html5Qrcode) { setStatus('eventScannerStatus','Scanner is still loading. Please try again.','error'); return; }
  if (scanner) return;
  const start = document.getElementById('startEventAttendanceScanner');
  const stop = document.getElementById('stopEventAttendanceScanner');
  start.disabled = true;
  setStatus('eventScannerStatus','Requesting camera access…');
  scanner = new Html5Qrcode('eventAttendanceReader');
  try {
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},async decoded => {
      if (scanBusy) return;
      scanBusy = true;
      const member = memberFromQr(decoded);
      if (!member) setStatus('eventScannerStatus','QR does not match an accessible member.','error');
      else await checkIn(eventId,member.id,'qr',null,'eventScannerStatus');
      setTimeout(() => { scanBusy = false; },1200);
    },() => {});
    stop.disabled = false;
    setStatus('eventScannerStatus','Camera ready. Point it at a member QR.','success');
  } catch (error) {
    scanner = null;
    start.disabled = false;
    setStatus('eventScannerStatus','Camera permission or a camera device is required.','error');
  }
}

async function stopScanner() {
  if (scanner) {
    try { await scanner.stop(); } catch (error) {}
    try { scanner.clear(); } catch (error) {}
    scanner = null;
  }
  const start = document.getElementById('startEventAttendanceScanner');
  const stop = document.getElementById('stopEventAttendanceScanner');
  if (start) start.disabled = false;
  if (stop) stop.disabled = true;
}

function exportCsv(event, rows) {
  const records = modeOf(event) === 'attendance_only' ? rows.filter(isCheckedIn) : rows;
  const values = [['Member','Member Code','Area','Status','Checked In','Source']];
  records.forEach(row => {
    const member = memberById(row.member_id);
    values.push([memberName(member),member?.member_code || '',areaName(member?.area_id),isCheckedIn(row)?'Attended':row.status,row.checked_in_at ? fmtDateTime(row.checked_in_at) : '',row.check_in_source || '']);
  });
  const csv = values.map(columns => columns.map(value => '"'+String(value ?? '').replaceAll('"','""')+'"').join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  link.download = (event.title || 'event').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-attendance.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href),1000);
}

async function unmount() {
  await stopScanner();
  root = null;
  selectedEventId = null;
}

window.VCCFEventAttendance = {mount,unmount};
})();

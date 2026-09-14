(() => {
'use strict';
if (window.__VCCF_PERSONALIZED_DASHBOARD_V1__) return;
window.__VCCF_PERSONALIZED_DASHBOARD_V1__ = true;

const state = () => window.VCCF?.getState?.() || {};
const sb = () => window.VCCF?.sb;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role = () => String(state().profile?.role || 'member').toLowerCase();
const roleLabel = value => String(value || 'member').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const memberId = () => state().profile?.member_id || null;
const todayPH = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const activeMembers = () => (state().members || []).filter(m => m.is_active !== false && String(m.status || '').toLowerCase() !== 'inactive');
const memberName = m => m?.display_name || [m?.first_name,m?.last_name].filter(Boolean).join(' ') || m?.member_number || m?.member_code || 'Member';
const dateOnlyLabel = value => value ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(String(value).slice(0,10)+'T12:00:00+08:00')) : '';
const dateTimeLabel = value => value ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)) : '';

let dataCache = null;
let dataCacheAt = 0;
let refreshTimer = 0;
let rendering = false;
let onboardingCheckedFor = '';
let dashboardObserver = null;

function go(route) {
  const direct = document.querySelector(`[data-route="${String(route).replace(/"/g,'')}"]`);
  if (direct) { direct.click(); return true; }
  if (route === 'worship-schedule') {
    const worship = document.querySelector('[data-worship-view="schedule"]');
    if (worship) { worship.click(); return true; }
  }
  return false;
}

async function safe(run, fallback = null) {
  try {
    const result = await run();
    if (result?.error) throw result.error;
    return result?.data ?? fallback;
  } catch (error) {
    console.warn('VCCF personalized dashboard data', error?.message || error);
    return fallback;
  }
}

function sundayKey(date) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

function lastEligibleSunday(attended) {
  const today = todayPH();
  const current = new Date(today+'T12:00:00+08:00');
  const dow = current.getDay();
  current.setDate(current.getDate() - dow);
  const key = sundayKey(current);
  if (dow === 0 && !attended.has(key)) current.setDate(current.getDate() - 7);
  return current;
}

function computeStreak(rows) {
  const attended = new Set((rows || [])
    .filter(row => String(row.attendance_type || 'sunday').toLowerCase() === 'sunday' && row.checked_in_at)
    .map(row => sundayKey(new Date(row.checked_in_at))));
  if (!attended.size) return 0;
  const cursor = lastEligibleSunday(attended);
  let streak = 0;
  for (let i=0; i<104; i++) {
    const key = sundayKey(cursor);
    if (!attended.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

async function loadVerse(client) {
  const today = todayPH();
  const selected = await safe(() => client.from('daily_bible_verse_selections')
    .select('reference,verse_text,translation')
    .eq('verse_date', today)
    .maybeSingle());
  if (selected?.reference || selected?.verse_text) return selected;
  const fallback = await safe(() => client.from('bible_verses')
    .select('reference,verse_text,translation')
    .eq('is_active', true)
    .order('sort_order',{ascending:true})
    .limit(1)
    .maybeSingle());
  return fallback || null;
}

async function loadUpcomingEvent(client) {
  const rows = await safe(() => client.from('church_events')
    .select('id,title,start_at,location,status')
    .gte('start_at', new Date().toISOString())
    .order('start_at',{ascending:true})
    .limit(8), []);
  return (rows || []).find(row => !['cancelled','canceled','completed','draft'].includes(String(row.status || '').toLowerCase())) || null;
}

async function loadLatestSermon(client) {
  const rows = await safe(() => client.from('vccf_sermons')
    .select('id,title,preacher,sermon_date,created_at')
    .order('sermon_date',{ascending:false,nullsFirst:false})
    .order('created_at',{ascending:false})
    .limit(1), []);
  return rows?.[0] || null;
}

async function loadMyAssignment(client) {
  const mid = memberId();
  if (!mid) return null;
  const assignments = await safe(() => client.from('worship_schedule_assignments')
    .select('schedule_id,ministry_role,notes')
    .eq('member_id', mid), []);
  const ids = [...new Set((assignments || []).map(x => x.schedule_id).filter(Boolean))];
  if (!ids.length) return null;
  const schedules = await safe(() => client.from('worship_service_schedules')
    .select('id,service_date,service_name')
    .in('id', ids)
    .gte('service_date', todayPH())
    .order('service_date',{ascending:true}), []);
  const schedule = schedules?.[0];
  if (!schedule) return null;
  const assignment = (assignments || []).find(x => x.schedule_id === schedule.id) || {};
  return {...schedule, ministry_role: assignment.ministry_role || 'Minister', notes: assignment.notes || ''};
}

async function loadStreak(client) {
  const mid = memberId();
  if (!mid) return 0;
  const start = new Date();
  start.setDate(start.getDate() - 370);
  const rows = await safe(() => client.from('attendance')
    .select('checked_in_at,attendance_type')
    .eq('member_id', mid)
    .eq('attendance_type','sunday')
    .gte('checked_in_at', start.toISOString())
    .order('checked_in_at',{ascending:false}), []);
  return computeStreak(rows || []);
}

async function loadPersonalData(force=false) {
  if (!force && dataCache && Date.now()-dataCacheAt < 60000) return dataCache;
  const client = sb();
  if (!client) return null;
  const [verse,event,sermon,assignment,streak] = await Promise.all([
    loadVerse(client),
    loadUpcomingEvent(client),
    loadLatestSermon(client),
    loadMyAssignment(client),
    loadStreak(client)
  ]);
  dataCache = {verse,event,sermon,assignment,streak};
  dataCacheAt = Date.now();
  return dataCache;
}

function scopeCopy() {
  const r = role();
  if (r === 'admin') return 'Church-wide priorities and the information you are most likely to need next.';
  if (r === 'pastor') return 'Church-wide ministry priorities and the information you are most likely to need next.';
  if (r === 'area_leader') return 'Your area, Sunday responsibilities, and the church updates most relevant to you.';
  if (r === 'treasurer') return 'Your Sunday participation, church updates, and quick access to the tools you use most.';
  return 'Your Sunday participation, ministry schedule, and the latest from VCCF Santa Maria.';
}

function icon(kind) {
  const icons = {
    verse:'✦', event:'◷', sermon:'▤', streak:'🔥', assignment:'♪', id:'⌁', members:'♙', attendance:'✓', overview:'⌂', announcements:'◉', settings:'⚙'
  };
  return icons[kind] || '•';
}

function card({kind,label,value,detail,route,action='Open',tone=''}) {
  return `<article class="vccf-for-you-card ${tone ? 'tone-'+esc(tone) : ''}">
    <div class="vccf-for-you-icon" aria-hidden="true">${icon(kind)}</div>
    <div class="vccf-for-you-copy"><span>${esc(label)}</span><strong>${esc(value || '—')}</strong><p>${esc(detail || '')}</p></div>
    ${route ? `<button type="button" class="vccf-for-you-action" data-personal-route="${esc(route)}">${esc(action)} <span aria-hidden="true">→</span></button>` : ''}
  </article>`;
}

function buildCards(data) {
  const r = role();
  const cards = [];
  if (data?.verse) cards.push(card({kind:'verse',label:'Verse of the Day',value:data.verse.reference || 'Today’s verse',detail:String(data.verse.verse_text || '').slice(0,145)+(String(data.verse.verse_text || '').length>145?'…':''),tone:'verse'}));
  if (data?.assignment) cards.push(card({kind:'assignment',label:'Next Ministry Assignment',value:data.assignment.ministry_role,detail:`${dateOnlyLabel(data.assignment.service_date)}${data.assignment.service_name?' · '+data.assignment.service_name:''}`,route:'worship-schedule',action:'View schedule',tone:'ministry'}));
  if (['member','treasurer'].includes(r)) {
    cards.push(card({kind:'streak',label:'Sunday Attendance Streak',value:`${Number(data?.streak || 0)} Sunday${Number(data?.streak || 0)===1?'':'s'}`,detail:data?.streak ? 'Keep showing up, serving, and growing together.' : 'Attend on Sunday to begin your streak.',route:'selfcheck',action:'Attendance'}));
    cards.push(card({kind:'id',label:'Digital ID',value:'Your VCCF member ID',detail:'View your current Digital ID and physical ID request options.',route:'memberid',action:'View ID'}));
  }
  if (r === 'area_leader') {
    const count = activeMembers().length;
    cards.push(card({kind:'members',label:'My Area',value:`${count} active member${count===1?'':'s'}`,detail:'Review member records and keep your area information up to date.',route:'members',action:'View members'}));
    cards.push(card({kind:'attendance',label:'Sunday Attendance',value:'Ready for your area',detail:'Open attendance tools for the members you are responsible for.',route:'attendance',action:'Take attendance'}));
  }
  if (['admin','pastor'].includes(r)) {
    const count = activeMembers().length;
    cards.push(card({kind:'members',label:'Active Members',value:String(count),detail:'Current members visible in your church-wide scope.',route:'members',action:'View members'}));
    cards.push(card({kind:'overview',label:'Church Overview',value:'Management workspace',detail:'Jump to church-wide areas, reports, ministries, and operations.',route:'overview',action:'Open overview'}));
  }
  if (data?.event) cards.push(card({kind:'event',label:'Upcoming Event',value:data.event.title || 'Church event',detail:`${dateTimeLabel(data.event.start_at)}${data.event.location?' · '+data.event.location:''}`,route:'events',action:'View event',tone:'event'}));
  if (data?.sermon) cards.push(card({kind:'sermon',label:'Latest Sermon',value:data.sermon.title || 'Latest sermon',detail:[data.sermon.preacher,dateOnlyLabel(data.sermon.sermon_date || data.sermon.created_at)].filter(Boolean).join(' · '),route:'sermons',action:'Open sermon'}));
  if (!cards.length) cards.push(card({kind:'settings',label:'Your VCCF Home',value:'You’re all set',detail:'Personalized church updates will appear here as they become available.',route:'settings',action:'Profile settings'}));
  return cards.slice(0,6).join('');
}

async function renderPersonalized(force=false) {
  if (rendering) return;
  const root = document.getElementById('dashboard');
  if (!root || !root.classList.contains('active')) return;
  rendering = true;
  try {
    const data = await loadPersonalData(force);
    if (!data) return;
    let section = document.getElementById('vccfForYou');
    if (!section) {
      section = document.createElement('section');
      section.id = 'vccfForYou';
      section.className = 'vccf-for-you';
      const welcome = root.querySelector('.welcome-banner');
      if (welcome) welcome.insertAdjacentElement('afterend', section);
      else root.prepend(section);
    }
    const p = state().profile || {};
    const ownMember = (state().members || []).find(m => m.id === p.member_id);
    const fullName = p.display_name || memberName(ownMember) || state().session?.user?.email || 'Kapatid';
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Kapatid';
    section.innerHTML = `<div class="vccf-for-you-head">
      <div><span class="vccf-for-you-kicker">FOR YOU</span><h2>${esc(firstName)}’s VCCF Home</h2><p>${esc(scopeCopy())}</p></div>
      <span class="vccf-for-you-role">${esc(roleLabel(role()))}</span>
    </div><div class="vccf-for-you-grid">${buildCards(data)}</div>`;
    section.querySelectorAll('[data-personal-route]').forEach(button => button.addEventListener('click', () => go(button.dataset.personalRoute)));
  } finally {
    rendering = false;
  }
}

function scheduleRefresh(force=false, delay=180) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => renderPersonalized(force), delay);
}

function watchDashboard() {
  const root = document.getElementById('dashboard');
  if (!root || dashboardObserver) return;
  dashboardObserver = new MutationObserver(() => {
    if (!rendering && root.classList.contains('active') && !document.getElementById('vccfForYou')) scheduleRefresh(false,80);
  });
  dashboardObserver.observe(root,{childList:true,subtree:false});
}

function onboardingSlides() {
  const r = role();
  const roleText = r === 'area_leader'
    ? 'Your dashboard highlights your area members, attendance responsibilities, and church updates.'
    : ['admin','pastor'].includes(r)
      ? 'Your dashboard brings church-wide priorities, member activity, and management shortcuts together.'
      : 'Your dashboard highlights your Sunday streak, ministry assignment, events, sermons, and daily verse.';
  return [
    {eyebrow:'WELCOME TO VCCF CONNECT',title:'Everything you need, in one church home.',body:'Your dashboard is personalized so the most relevant church information and actions are easier to find.',icon:'⌂'},
    {eyebrow:'YOUR PROFILE',title:'Keep your member information current.',body:'Check your name, area, contact details, and profile photo. Your profile information is shared with features that depend on your member record.',icon:'◉'},
    {eyebrow:'YOUR DIGITAL ID',title:'Your member identity is one tap away.',body:'Open Digital ID anytime to view your VCCF member ID and, when available, request a physical ID.',icon:'⌁'},
    {eyebrow:'YOUR HOME',title:'You’re ready to explore.',body:roleText,icon:'✦'}
  ];
}

function closeOnboarding() {
  const overlay = document.getElementById('vccfOnboarding');
  if (!overlay) return;
  overlay.remove();
  document.documentElement.classList.remove('vccf-onboarding-open');
}

async function persistOnboarding(button, status) {
  const client = sb(), uid = state().session?.user?.id;
  if (!client || !uid) return false;
  if (button) button.disabled = true;
  if (status) status.textContent = 'Saving…';
  const completedAt = new Date().toISOString();
  const result = await client.from('profiles')
    .update({onboarding_completed_at: completedAt, updated_at: completedAt})
    .eq('user_id', uid)
    .select('onboarding_completed_at')
    .maybeSingle();
  if (result.error || !result.data?.onboarding_completed_at) {
    if (status) status.textContent = result.error?.message || 'Could not save your onboarding status. Please try again.';
    if (button) button.disabled = false;
    return false;
  }
  return true;
}

function showOnboarding() {
  if (document.getElementById('vccfOnboarding')) return;
  const slides = onboardingSlides();
  let index = 0;
  const overlay = document.createElement('div');
  overlay.id = 'vccfOnboarding';
  overlay.className = 'vccf-onboarding';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','vccfOnboardingTitle');
  overlay.innerHTML = `<div class="vccf-onboarding-card card"><div class="vccf-onboarding-brand"><img src="/vccf-logo-black.png?v=20260903-2" alt="VCCF Santa Maria"><span>VCCF Connect</span></div><div id="vccfOnboardingBody"></div><div class="vccf-onboarding-footer"><button type="button" class="vccf-onboarding-skip">Skip tour</button><div class="vccf-onboarding-controls"><button type="button" class="vccf-onboarding-back">Back</button><button type="button" class="btn vccf-onboarding-next">Next</button></div></div><div class="vccf-onboarding-status" role="status"></div></div>`;
  document.body.appendChild(overlay);
  document.documentElement.classList.add('vccf-onboarding-open');
  const body = overlay.querySelector('#vccfOnboardingBody');
  const back = overlay.querySelector('.vccf-onboarding-back');
  const next = overlay.querySelector('.vccf-onboarding-next');
  const skip = overlay.querySelector('.vccf-onboarding-skip');
  const status = overlay.querySelector('.vccf-onboarding-status');
  const paint = () => {
    const slide = slides[index];
    body.innerHTML = `<div class="vccf-onboarding-progress"><span>Step ${index+1} of ${slides.length}</span><div>${slides.map((_,i)=>`<i class="${i===index?'active':''}"></i>`).join('')}</div></div><div class="vccf-onboarding-illustration" aria-hidden="true">${slide.icon}</div><span class="vccf-onboarding-eyebrow">${esc(slide.eyebrow)}</span><h2 id="vccfOnboardingTitle">${esc(slide.title)}</h2><p>${esc(slide.body)}</p>`;
    back.disabled = index === 0;
    next.textContent = index === slides.length-1 ? 'Start exploring' : 'Next';
    status.textContent = '';
    setTimeout(() => next.focus(),0);
  };
  back.addEventListener('click',() => { if(index>0){index-=1;paint();} });
  next.addEventListener('click',async() => {
    if (index < slides.length-1) { index += 1; paint(); return; }
    if (await persistOnboarding(next,status)) closeOnboarding();
  });
  skip.addEventListener('click',async() => { if (await persistOnboarding(skip,status)) closeOnboarding(); });
  overlay.addEventListener('keydown',event => {
    if (event.key === 'Escape') { event.preventDefault(); skip.focus(); }
  });
  paint();
}

async function checkOnboarding(force=false) {
  const client = sb(), uid = state().session?.user?.id;
  if (!client || !uid) return;
  if (!force && onboardingCheckedFor === uid) return;
  if (document.querySelector('dialog[open],.password-modal,.force-password-modal')) {
    setTimeout(() => checkOnboarding(force),1200);
    return;
  }
  const result = await client.from('profiles').select('onboarding_completed_at,must_change_password').eq('user_id',uid).maybeSingle();
  if (result.error) { console.warn('VCCF onboarding check',result.error.message); onboardingCheckedFor=''; return; }
  if (result.data?.must_change_password) { setTimeout(() => checkOnboarding(force),1800); return; }
  onboardingCheckedFor = uid;
  if (!result.data?.onboarding_completed_at) showOnboarding();
}

function boot() {
  watchDashboard();
  scheduleRefresh(false,900);
  setTimeout(() => checkOnboarding(),650);
}

window.addEventListener('vccf-app-ready',boot);
window.addEventListener('vccf-signed-out',() => {
  dataCache=null; dataCacheAt=0; onboardingCheckedFor=''; closeOnboarding();
});
window.addEventListener('vccf-profile-linked',() => scheduleRefresh(true));
window.addEventListener('vccf-profile-photo-updated',() => scheduleRefresh(false));
window.addEventListener('vccf-members-changed',() => scheduleRefresh(true));
document.addEventListener('click',event => {
  if (event.target.closest?.('[data-route="dashboard"],button[data-view="dashboard"]')) scheduleRefresh(false,450);
  if (event.target.closest?.('#checkinBtn')) scheduleRefresh(true,900);
});
window.VCCFOnboarding = {restart: showOnboarding};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => setTimeout(boot,1100),{once:true});
else setTimeout(boot,1100);
})();

(() => {
'use strict';
if (window.VCCFMemberIds) return;

if (!document.querySelector('link[data-vccf-id-interactions]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/vccf-id-interactions.css?v=20260915-1';
  link.dataset.vccfIdInteractions = '1';
  document.head.appendChild(link);
}
if (!window.__VCCF_ID_INTERACTIONS_V1__ && !document.querySelector('script[data-vccf-id-interactions]')) {
  const script = document.createElement('script');
  script.src = '/vccf-id-interactions.js?v=20260915-1';
  script.defer = true;
  script.dataset.vccfIdInteractions = '1';
  document.head.appendChild(script);
}

const state = () => window.VCCF?.getState?.() || {};
const client = () => window.VCCF?.sb;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const name = member => member.display_name || [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Member';
const number = member => member.member_number || 'Not assigned';
const canManage = profile => ['admin', 'pastor'].includes(String(profile?.role || '').toLowerCase());
const canEditTemplate = profile => String(profile?.role || '').toLowerCase() === 'admin';
const labels = {pending:'Pending', printing:'Printing', ready:'Ready for pickup', collected:'Collected', declined:'Declined', cancelled:'Cancelled'};
const nextStatus = {pending:['printing','declined','cancelled'], printing:['ready','cancelled'], ready:['collected','cancelled'], collected:[], declined:[], cancelled:[]};
const openStatuses = ['pending', 'printing', 'ready'];
const date = value => value ? new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila', month:'short', day:'numeric', year:'numeric'}).format(new Date(value)) : '—';
const birthday = value => value ? date(String(value) + 'T12:00:00+08:00') : 'Not recorded';
const cardBirthday = value => value ? new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila', month:'long', day:'numeric', year:'numeric'}).format(new Date(String(value) + 'T12:00:00+08:00')) : 'Not recorded';
const address = member => member.address || [member.barangay, member.city_municipality, member.province].filter(Boolean).join(', ') || 'Not recorded';
const area = member => member.areas?.name || (state().areas || []).find(item => item.id === member.area_id)?.name || 'No designated area';
const memberFields = 'id,member_number,member_code,first_name,last_name,display_name,member_type,area_id,photo_url,birth_date,address,barangay,city_municipality,province,contact_number,email,updated_at,areas(name)';
const requestFields = 'id,member_id,requested_by,status,request_notes,admin_notes,created_at,updated_at';
const templateFields = 'id,template_url,storage_path,updated_at,updated_by';
const templateBucket = 'vccf-id-templates';

let root = null;
let mode = 'self';
let selectedId = null;
let loadedMember = null;
let loadedProfile = null;
let requests = [];
let templateSettings = null;
let generation = 0;
let inFlight = null;
let signature = '';
let draftNotes = '';
let queueFilter = 'open';
let feedback = '';
let templateFeedback = '';
let cardObserver = null;
let exportBusy = false;

function ensureTemplateStyles() {
  if (document.getElementById('vccf-id-template-styles')) return;
  const style = document.createElement('style');
  style.id = 'vccf-id-template-styles';
  style.textContent = `
    .id-card.id-card-custom-template{background:#fff!important}
    .id-card-template-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;user-select:none}
    .id-card-custom-template .id-card-art,.id-card-custom-template .id-card-logo,.id-card-custom-template .id-card-divider,.id-card-custom-template .id-card-footer{display:none!important}
    .id-card-custom-template .id-card-field dt{visibility:hidden!important}
    .id-card-custom-template .id-photo,.id-card-custom-template .id-qr,.id-card-custom-template .id-card-name,.id-card-custom-template .id-area,.id-card-custom-template .id-card-field{z-index:2}
    .id-template-admin{margin-bottom:18px}
    .id-template-admin-grid{display:grid;grid-template-columns:minmax(210px,.9fr) minmax(0,1.1fr);gap:20px;align-items:start}
    .id-template-preview{width:100%;aspect-ratio:324/205;border:1px solid var(--line,#e5e7eb);border-radius:10px;overflow:hidden;background:var(--bg,#f5f6f8);display:grid;place-items:center}
    .id-template-preview img{display:block;width:100%;height:100%;object-fit:cover}
    .id-template-preview span{padding:18px;text-align:center;color:var(--muted,#626b78);font-size:.875rem;line-height:1.45}
    .id-template-admin form{display:grid;gap:12px}.id-template-admin input[type=file]{width:100%;padding:11px;border:1px solid var(--line,#d1d5db);border-radius:10px;background:var(--bg,#f5f6f8);color:var(--text,#15171c)}
    .id-template-actions{display:flex;gap:10px;flex-wrap:wrap}.id-template-actions .btn{flex:1;min-width:160px}
    .id-template-help{margin:0;color:var(--muted,#626b78);font-size:.875rem;line-height:1.5}
    [data-id-template-feedback]{min-height:22px;font-size:.875rem;line-height:1.45}
    @media(max-width:700px){.id-template-admin-grid{grid-template-columns:1fr}.id-template-actions{display:grid}.id-template-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

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
function templateMessage(text, error = false) {
  templateFeedback = text || '';
  const target = root?.querySelector('[data-id-template-feedback]');
  if (target) {
    target.textContent = templateFeedback;
    target.classList.toggle('id-error', error);
  }
}
function personalDetails(member) {
  return [
    ['Name', name(member)],
    ['Member number', number(member)],
    ['Area', area(member)],
    ['Birthday', birthday(member.birth_date)],
    ['Address', address(member)],
    ['Contact number', member.contact_number || 'Not recorded'],
    ['Email', member.email || 'Not recorded']
  ].map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
}
function cardMarkup(member, photo) {
  const initials = name(member).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const templateUrl = templateSettings?.template_url || '';
  return `<div class="id-card-shell"><article class="id-card${templateUrl ? ' id-card-custom-template' : ''}" aria-label="Digital member ID">
    ${templateUrl ? `<img class="id-card-template-image" src="${esc(templateUrl)}" alt="" aria-hidden="true">` : ''}
    <div class="id-card-art" aria-hidden="true"></div>
    <img class="id-card-logo" src="/vccf-logo-black.png" alt="Victorious Cross Christian Fellowship Santa Maria">
    <div class="id-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(name(member))}">` : `<span aria-label="Profile picture not uploaded">${esc(initials)}</span>`}</div>
    <div class="id-qr" data-digital-id-qr aria-label="Member attendance QR code"></div>
    <h2 class="id-card-name" data-id-fit="5.556" data-id-min="2.2" title="${esc(name(member))}">${esc(name(member))}</h2>
    <p class="id-area" data-id-fit="3.55" data-id-min="2" title="${esc(area(member))}">${esc(area(member))}</p>
    <div class="id-card-divider" aria-hidden="true"></div>
    <dl class="id-card-field id-card-dob"><dt>Date of birth</dt><dd data-id-fit="2.16" data-id-min="1.7">${esc(cardBirthday(member.birth_date))}</dd></dl>
    <dl class="id-card-field id-card-number"><dt>Member number</dt><dd class="id-number">${esc(number(member))}</dd></dl>
    <dl class="id-card-field id-card-phone"><dt>Mobile no.</dt><dd data-id-fit="2.16" data-id-min="1.7">${esc(member.contact_number || 'Not recorded')}</dd></dl>
    <dl class="id-card-field id-card-address"><dt>Address</dt><dd title="${esc(address(member))}">${esc(address(member))}</dd></dl>
    <footer class="id-card-footer"><p class="id-card-church">Victorious Cross Christian<br>Fellowship - Santa Maria</p><p class="id-card-motto">One God.<br>One Family.</p></footer>
  </article></div>`;
}
function fitCardText() {
  root?.querySelectorAll('[data-id-fit]').forEach(element => {
    const maximum = Number(element.dataset.idFit);
    const minimum = Number(element.dataset.idMin);
    element.style.fontSize = maximum + 'cqw';
    if (!element.clientWidth || element.scrollWidth <= element.clientWidth) return;
    element.style.fontSize = Math.max(minimum, maximum * element.clientWidth / element.scrollWidth * .98) + 'cqw';
  });
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
  cardObserver?.disconnect();
  if (!loadedMember) {
    root.innerHTML = '<section class="id-panel"><h2>Digital ID</h2><p>Your account needs a linked member record before an ID can be shown. Ask an administrator to link your account to your member profile.</p><div data-id-feedback role="status"></div></section>';
    return;
  }
  const own = loadedMember.id === loadedProfile?.member_id;
  const photo = loadedMember.photo_url || (own ? loadedProfile.profile_photo_url : '') || '';
  root.innerHTML = `<div class="id-layout"><div>${cardMarkup(loadedMember, photo)}<div class="id-card-actions"><button type="button" class="btn" data-download-id ${exportBusy ? 'disabled' : ''}>Download ID (PNG)</button><button type="button" class="btn secondary" data-print-id ${exportBusy ? 'disabled' : ''}>Print ID</button></div><div data-id-export-feedback role="status" aria-live="polite"></div><p class="id-live-note">Your Digital ID follows your saved member information and the church's current ID template. Your member number stays the same.</p></div><div class="id-side"><section class="id-panel"><h2>Personal details</h2><dl class="id-details">${personalDetails(loadedMember)}</dl></section>${requestMarkup(own)}${!own ? '<div data-id-feedback role="status" aria-live="polite"></div>' : ''}</div></div>`;
  const qr = root.querySelector('[data-digital-id-qr]');
  if (window.QRCode && loadedMember.member_number) {
    new window.QRCode(qr, {text:'VCCF-MEMBER:' + loadedMember.member_number, width:256, height:256, colorDark:'#111111', colorLight:'#ffffff', correctLevel:window.QRCode.CorrectLevel.H});
  } else {
    qr.textContent = 'QR unavailable. Use your member number for attendance.';
  }
  fitCardText();
  if (window.ResizeObserver) {
    cardObserver = new ResizeObserver(fitCardText);
    cardObserver.observe(root.querySelector('.id-card-shell'));
  }
  document.fonts?.ready.then(fitCardText);
  root.querySelector('[data-download-id]').addEventListener('click', () => exportId(false));
  root.querySelector('[data-print-id]').addEventListener('click', () => exportId(true));
  const form = root.querySelector('[data-id-request-form]');
  if (form) {
    form.elements.notes.addEventListener('input', event => { draftNotes = event.target.value; });
    form.addEventListener('submit', submitRequest);
  }
  root.querySelector('[data-cancel-id-request]')?.addEventListener('click', cancelRequest);
}
function loadIdImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.onload = image.onerror = null; reject(new Error('An ID image could not be loaded. Please try again.')); }, 15000);
    if (new URL(src, location.href).origin !== location.origin) image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('An ID image could not be loaded for download or printing. Please try again.')); };
    image.src = src;
  });
}
function isVisibleForExport(element) {
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}
async function idCanvas() {
  await document.fonts?.ready;
  fitCardText();
  const card = root.querySelector('.id-card');
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height) throw new Error('Open your Digital ID before downloading or printing.');
  const box = element => {
    const rect = element.getBoundingClientRect();
    return {x:rect.left-bounds.left, y:rect.top-bounds.top, w:rect.width, h:rect.height};
  };
  const texts = Array.from(card.querySelectorAll('h2,.id-area,dt,dd,.id-card-footer p')).filter(isVisibleForExport).map(element => {
    const style = getComputedStyle(element);
    let value = Array.from(element.childNodes).map(node => node.nodeName === 'BR' ? '\n' : node.textContent).join('');
    if (style.textTransform === 'uppercase') value = value.toUpperCase();
    return {...box(element), text:value, size:parseFloat(style.fontSize), line:parseFloat(style.lineHeight) || parseFloat(style.fontSize)*1.2,
      font:`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, color:style.color, gradient:element.classList.contains('id-card-name'),
      fixed:!!element.closest('.id-card-footer'),
      wrap:element.closest('.id-card-address') && element.tagName === 'DD'};
  });
  const photo = card.querySelector('.id-photo');
  const photoStyle = getComputedStyle(photo);
  const photoBox = box(photo);
  const photoSrc = photo.querySelector('img')?.src;
  const initials = photo.textContent;
  const qrElement = card.querySelector('.id-qr');
  const qrBox = box(qrElement);
  const qrPadding = parseFloat(getComputedStyle(qrElement).paddingLeft);
  const qr = qrElement.querySelector('canvas') || qrElement.querySelector('img');
  if (!qr) throw new Error('Your QR code is unavailable. Please reload your Digital ID.');

  const templateUrl = templateSettings?.template_url || '';
  let customTemplate = null;
  let background = null;
  let artwork = null;
  let brand = null;
  if (templateUrl) {
    customTemplate = await loadIdImage(templateUrl);
  } else {
    [background, artwork, brand] = await Promise.all([
      loadIdImage('/Churchfront_login.png'),
      loadIdImage('/assets/vccf-id-orange-art.png'),
      loadIdImage('/vccf-logo-black.png')
    ]);
  }
  const portrait = photoSrc ? await loadIdImage(photoSrc) : null;

  const canvas = document.createElement('canvas');
  canvas.width = 1944;
  canvas.height = 1230;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot create an ID image.');
  ctx.scale(canvas.width/bounds.width, canvas.height/bounds.height);
  const cover = (image, rect) => {
    const scale = Math.max(rect.w/image.naturalWidth, rect.h/image.naturalHeight);
    const w = rect.w/scale, h = rect.h/scale;
    ctx.drawImage(image, (image.naturalWidth-w)/2, (image.naturalHeight-h)/2, w, h, rect.x, rect.y, rect.w, rect.h);
  };

  if (customTemplate) {
    cover(customTemplate, {x:0,y:0,w:bounds.width,h:bounds.height});
  } else {
    const art = box(card.querySelector('.id-card-art'));
    const logo = box(card.querySelector('.id-card-logo'));
    const divider = box(card.querySelector('.id-card-divider'));
    const footer = box(card.querySelector('.id-card-footer'));
    cover(background, {x:0,y:0,w:bounds.width,h:bounds.height});
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(0,0,bounds.width,bounds.height);
    ctx.globalAlpha = .18;
    ctx.drawImage(artwork, art.x,art.y,art.w,art.h);
    ctx.globalAlpha = 1;
    const brandScale = Math.min(logo.w/brand.naturalWidth,logo.h/brand.naturalHeight);
    const brandW = brand.naturalWidth*brandScale, brandH = brand.naturalHeight*brandScale;
    ctx.drawImage(brand,logo.x+(logo.w-brandW)/2,logo.y+(logo.h-brandH)/2,brandW,brandH);
    ctx.fillStyle='#191919';
    ctx.fillRect(divider.x,divider.y,divider.w,divider.h);
    const band=ctx.createLinearGradient(0,0,bounds.width,0);
    band.addColorStop(0,'#850201');
    band.addColorStop(1,'#e88929');
    ctx.fillStyle=band;
    ctx.fillRect(footer.x,footer.y,footer.w,footer.h);
  }

  ctx.fillStyle = '#111';
  ctx.fillRect(photoBox.x,photoBox.y,photoBox.w,photoBox.h);
  const border = parseFloat(photoStyle.borderLeftWidth);
  const inset = {x:photoBox.x+border,y:photoBox.y+border,w:photoBox.w-2*border,h:photoBox.h-2*border};
  ctx.fillStyle = '#f1f0ee';
  ctx.fillRect(inset.x,inset.y,inset.w,inset.h);
  if (portrait) cover(portrait,inset);
  else {
    ctx.font = `${photoStyle.fontWeight} ${photoStyle.fontSize} ${photoStyle.fontFamily}`;
    ctx.fillStyle='#8c1414';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(initials,inset.x+inset.w/2,inset.y+inset.h/2);
  }
  ctx.fillStyle='#fff';
  ctx.fillRect(qrBox.x,qrBox.y,qrBox.w,qrBox.h);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(qr,qrBox.x+qrPadding,qrBox.y+qrPadding,qrBox.w-2*qrPadding,qrBox.h-2*qrPadding);
  ctx.imageSmoothingEnabled=true;
  ctx.textAlign='left';
  ctx.textBaseline='top';

  for (const item of texts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(item.x,item.y,item.w,item.wrap?item.line*4:item.h);
    ctx.clip();
    ctx.font=item.font;
    ctx.fillStyle=item.color;
    if(item.gradient){
      const gradient=ctx.createLinearGradient(item.x,0,item.x+item.w,0);
      gradient.addColorStop(0,'#ff712b');
      gradient.addColorStop(1,'#b5083b');
      ctx.fillStyle=gradient;
    }
    let lines=item.text.split('\n');
    if(item.wrap){
      lines=[''];
      for(const word of item.text.split(/\s+/)){
        const next=(lines.at(-1)?lines.at(-1)+' ':'')+word;
        if(ctx.measureText(next).width<=item.w){lines[lines.length-1]=next;continue;}
        if(lines.at(-1))lines.push('');
        for(const char of word){if(ctx.measureText(lines.at(-1)+char).width>item.w)lines.push('');lines[lines.length-1]+=char;}
      }
    }
    const limit=item.wrap?4:lines.length;
    lines.slice(0,limit).forEach((value,index)=>{
      if(!item.fixed&&(ctx.measureText(value).width>item.w || (item.wrap&&index===3&&lines.length>4))){while(value&&ctx.measureText(value+'…').width>item.w)value=value.slice(0,-1);value+='…';}
      const y=item.y+(item.line-item.size)/2+index*item.line;
      if(item.fixed)ctx.fillText(value,item.x,y,item.w);else ctx.fillText(value,item.x,y);
    });
    ctx.restore();
  }
  return canvas;
}
async function exportId(printing) {
  if (exportBusy || !loadedMember || !active()) return;
  const epoch=generation, uid=state().session.user.id, memberId=loadedMember.id;
  const win=printing?window.open('', '_blank'):null;
  if(printing&&!win){root.querySelector('[data-id-export-feedback]').textContent='Allow pop-ups for this site, then select Print ID again.';return;}
  if(win){win.document.write('<!doctype html><html><head><title>Preparing Digital ID</title></head><body><p>Preparing your ID…</p></body></html>');win.document.close();}
  exportBusy=true;
  root?.querySelectorAll('[data-download-id],[data-print-id]').forEach(button=>{button.disabled=true;});
  try {
    if(await refresh(true)!==true)throw new Error('Unable to load your latest member information. Please try again.');
    if(generation!==epoch||loadedMember?.id!==memberId||state().session?.user?.id!==uid)throw new Error('Your member session changed. Please try again.');
    root.querySelector('[data-id-export-feedback]').textContent='Preparing your ID…';
    const canvas=await idCanvas();
    if(generation!==epoch||state().session?.user?.id!==uid||loadedMember?.id!==memberId||!active())throw new Error('Your member session changed. Open the Digital ID and try again.');
    const filename=number(loadedMember);
    if(printing){
      if(win.closed)throw new Error('The print window was closed. Select Print ID to try again.');
      win.document.write(`<!doctype html><html><head><title>${esc(filename)} - Digital ID</title><style>@page{size:A4;margin:15mm}body{margin:0;font-family:Arial,sans-serif}.print-card{display:block;width:85.725mm;height:54.24mm}button{padding:12px 20px;margin:20px 0;font-size:16px}p{font-size:14px}@media print{button,p{display:none}}</style></head><body><img class="print-card" alt="Digital member ID"><button type="button">Print ID</button><p>Print at actual size (100%). You can also save as PDF from the print dialog.</p></body></html>`);
      win.document.close();
      win.document.querySelector('button').onclick=()=>{win.focus();win.print();};
      const image=win.document.querySelector('img');
      image.onload=()=>{win.focus();win.print();};
      image.src=canvas.toDataURL('image/png');
    } else {
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to create your ID image.')),'image/png'));
      if(generation!==epoch||state().session?.user?.id!==uid)throw new Error('Your member session changed. Please try again.');
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url;
      link.download=filename+'.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
    const target=root?.querySelector('[data-id-export-feedback]');
    if(target)target.textContent=printing?'Your ID is ready to print.':'Your ID download is ready.';
  } catch(error) {
    if(win&&!win.closed)win.close();
    if(generation===epoch){const target=root?.querySelector('[data-id-export-feedback]');if(target)target.textContent=error.message||'Unable to prepare your ID. Please try again.';}
  } finally {
    exportBusy=false;
    root?.querySelectorAll('[data-download-id],[data-print-id]').forEach(button=>{button.disabled=false;});
  }
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
function templateAdminMarkup() {
  const templateUrl = templateSettings?.template_url || '';
  const editable = canEditTemplate(loadedProfile);
  const updated = templateSettings?.updated_at ? date(templateSettings.updated_at) : '';
  return `<section class="id-panel id-template-admin">
    <h2>Digital ID template</h2>
    <div class="id-template-admin-grid">
      <div class="id-template-preview">${templateUrl ? `<img src="${esc(templateUrl)}" alt="Current Digital ID template">` : '<span>Using the built-in Digital ID design.</span>'}</div>
      <div>
        <p class="id-template-help">Upload a clean PNG, JPG, or WebP exported from Canva using the same 324 × 205 landscape proportion. Keep member-specific spaces blank; the app continues to place the photo, QR code, name, area, birthday, member number, mobile number, and address dynamically.</p>
        ${updated && templateUrl ? `<p class="id-template-help" style="margin-top:8px">Current template updated ${esc(updated)}.</p>` : ''}
        ${editable ? `<form data-id-template-form style="margin-top:14px"><label>Replacement template<input data-id-template-file type="file" accept="image/png,image/jpeg,image/webp" required></label><div class="id-template-actions"><button type="submit" class="btn">Upload & apply</button>${templateUrl ? '<button type="button" class="btn secondary" data-reset-id-template>Use built-in design</button>' : ''}</div></form>` : '<p class="id-template-help" style="margin-top:14px">Only an administrator can replace the Digital ID template.</p>'}
        <div data-id-template-feedback role="status" aria-live="polite">${esc(templateFeedback)}</div>
      </div>
    </div>
  </section>`;
}
function renderQueue() {
  const visible = queueFilter === 'open' ? requests.filter(item => openStatuses.includes(item.status)) : queueFilter === 'all' ? requests : requests.filter(item => item.status === queueFilter);
  root.innerHTML = `${templateAdminMarkup()}<section class="id-panel"><div class="id-queue-head"><div><h2>Physical ID requests</h2><p>Use the member’s latest information when preparing their ID.</p></div><a class="btn secondary" href="https://canva.link/1efsdjt75n44vin" target="_blank" rel="noopener noreferrer">Open ID template</a></div><label class="id-filter">Show requests<select data-id-filter>${[['open','Open requests'],['all','All requests'],...Object.entries(labels)].map(([key, label]) => `<option value="${key}" ${queueFilter === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div data-id-feedback role="status" aria-live="polite">${esc(feedback)}</div><div class="id-request-list">${visible.length ? visible.map(item => {
    const member = item.member;
    return `<article class="id-request-row"><div class="id-request-identity"><h3>${esc(member ? name(member) : 'Member record unavailable')}</h3><b class="id-number">${esc(member ? number(member) : '—')}</b><span>${esc(member ? area(member) : '')}</span><span class="id-date">Requested ${esc(date(item.created_at))}</span><span class="id-badge id-${esc(item.status)}">${labels[item.status]}</span>${item.request_notes ? `<p>${esc(item.request_notes)}</p>` : ''}${member ? `<button type="button" class="btn secondary" data-view-id-member="${esc(member.id)}">View Digital ID</button>` : ''}</div><form data-id-review-form data-request-id="${esc(item.id)}" data-old-status="${esc(item.status)}"><label>Status<select name="status">${[item.status, ...nextStatus[item.status]].map(status => `<option value="${status}">${labels[status]}</option>`).join('')}</select></label><label>Note for the member<textarea name="admin_notes" rows="2" maxlength="1000">${esc(item.admin_notes)}</textarea></label><button type="submit" class="btn">Save update</button><div data-review-feedback role="status"></div></form></article>`;
  }).join('') : '<p class="empty">No ID requests in this view.</p>'}</div>${requests.length === 200 ? '<p class="id-live-note">Showing the latest 200 requests.</p>' : ''}</section>`;
  root.querySelector('[data-id-filter]').addEventListener('change', event => { queueFilter = event.target.value; void refresh(true); });
  root.querySelectorAll('[data-id-review-form]').forEach(form => form.addEventListener('submit', reviewRequest));
  root.querySelectorAll('[data-view-id-member]').forEach(button => button.addEventListener('click', () => openMember(button.dataset.viewIdMember)));
  root.querySelector('[data-id-template-form]')?.addEventListener('submit', uploadTemplate);
  root.querySelector('[data-reset-id-template]')?.addEventListener('click', resetTemplate);
}
function safeTemplateFile(file) {
  const types = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  const ext = types[file?.type];
  if (!ext) throw new Error('Use a PNG, JPG, or WebP image for the Digital ID template.');
  if (file.size > 10 * 1024 * 1024) throw new Error('The Digital ID template must be 10 MB or smaller.');
  return ext;
}
async function uploadTemplate(event) {
  event.preventDefault();
  if (!canEditTemplate(loadedProfile)) return templateMessage('Only an administrator can change the Digital ID template.', true);
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  const file = form.querySelector('[data-id-template-file]')?.files?.[0];
  if (!file) return templateMessage('Choose a template image first.', true);
  let ext;
  try { ext = safeTemplateFile(file); }
  catch (error) { return templateMessage(error.message, true); }
  button.disabled = true;
  templateMessage('Uploading the new Digital ID template…');
  const uid = state().session?.user?.id;
  const unique = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  const path = `templates/${Date.now()}-${unique}.${ext}`;
  try {
    const {error:uploadError} = await client().storage.from(templateBucket).upload(path, file, {cacheControl:'31536000', contentType:file.type, upsert:false});
    if (uploadError) throw uploadError;
    const {data:urlData} = client().storage.from(templateBucket).getPublicUrl(path);
    const templateUrl = urlData?.publicUrl;
    if (!templateUrl) throw new Error('The uploaded template URL could not be created.');
    const {data, error} = await client().from('digital_id_template_settings').update({template_url:templateUrl,storage_path:path,updated_at:new Date().toISOString(),updated_by:uid}).eq('id','default').select(templateFields).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('The Digital ID template setting could not be updated.');
    templateSettings = data;
    templateFeedback = 'Template updated. Members will use this design the next time their Digital ID refreshes.';
    signature = '';
    await refresh(true);
    window.dispatchEvent(new CustomEvent('vccf-id-template-updated'));
  } catch (error) {
    templateMessage(error.message || 'Unable to update the Digital ID template.', true);
  } finally {
    button.disabled = false;
  }
}
async function resetTemplate(event) {
  const button = event.currentTarget;
  if (!canEditTemplate(loadedProfile)) return templateMessage('Only an administrator can change the Digital ID template.', true);
  button.disabled = true;
  templateMessage('Restoring the built-in Digital ID design…');
  try {
    const {data, error} = await client().from('digital_id_template_settings').update({template_url:null,storage_path:null,updated_at:new Date().toISOString(),updated_by:state().session?.user?.id}).eq('id','default').select(templateFields).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('The Digital ID template setting could not be updated.');
    templateSettings = data;
    templateFeedback = 'Built-in Digital ID design restored.';
    signature = '';
    await refresh(true);
    window.dispatchEvent(new CustomEvent('vccf-id-template-updated'));
  } catch (error) {
    templateMessage(error.message || 'Unable to restore the built-in Digital ID design.', true);
  } finally {
    button.disabled = false;
  }
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
async function loadTemplateSettings() {
  try {
    const {data, error} = await client().from('digital_id_template_settings').select(templateFields).eq('id','default').maybeSingle();
    if (error) throw error;
    templateSettings = data || null;
  } catch (error) {
    console.warn('Digital ID template settings unavailable; using the last known or built-in design.', error);
  }
  return templateSettings;
}
async function fetchSelf(epoch) {
  const uid = state().session?.user?.id;
  const [{data:profile, error:profileError}] = await Promise.all([
    client().from('profiles').select('user_id,member_id,role,profile_photo_url').eq('user_id', uid).maybeSingle(),
    loadTemplateSettings()
  ]);
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
  return JSON.stringify({member, profile, history, template:templateSettings});
}
async function fetchQueue(epoch) {
  const uid = state().session?.user?.id;
  const [{data:profile, error:profileError}] = await Promise.all([
    client().from('profiles').select('user_id,role').eq('user_id', uid).maybeSingle(),
    loadTemplateSettings()
  ]);
  if (profileError) throw profileError;
  if (!canManage(profile)) throw new Error('Only admins and pastors can manage physical ID requests.');
  let query = client().from('member_id_requests').select(`${requestFields},member:members(${memberFields})`).order('created_at', {ascending:false}).limit(200);
  if (queueFilter === 'open') query = query.in('status', openStatuses);
  else if (queueFilter !== 'all') query = query.eq('status', queueFilter);
  const {data, error} = await query;
  if (error) throw error;
  if (epoch !== generation) return null;
  loadedProfile = profile;
  requests = data || [];
  return JSON.stringify({requests, template:templateSettings});
}
async function refresh(force = false) {
  if (!active() || document.hidden) return;
  if (exportBusy && !force) return;
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
      if (epoch !== generation || !active() || fresh === null) return false;
      if (force || fresh !== signature) {
        signature = fresh;
        mode === 'queue' ? renderQueue() : renderSelf();
      }
      return true;
    } catch (error) {
      if (epoch !== generation || !active()) return;
      if (error.clearId) { signature = ''; loadedMember = loadedProfile = null; }
      if (!signature) root.innerHTML = '<section class="id-panel"><h2>Member ID unavailable</h2><div data-id-feedback role="status"></div><button type="button" class="btn secondary" data-id-retry>Try again</button></section>';
      message(error.message || 'Unable to refresh your ID. Please try again.', true);
      root.querySelector('[data-id-retry]')?.addEventListener('click', () => refresh(true), {once:true});
      return false;
    }
  })();
  inFlight = {epoch, promise:task};
  const succeeded = await task;
  if (inFlight?.promise === task) inFlight = null;
  return succeeded;
}
function mount(target, memberId = null) {
  ensureTemplateStyles();
  cardObserver?.disconnect();
  generation++;
  root = target;
  mode = 'self';
  selectedId = memberId;
  loadedMember = null;
  loadedProfile = null;
  signature = '';
  draftNotes = '';
  feedback = '';
  root.innerHTML = '<section class="id-panel" role="status">Loading Digital ID…</section>';
  void refresh(true);
}
function mountRequests(target) {
  ensureTemplateStyles();
  cardObserver?.disconnect();
  generation++;
  root = target;
  mode = 'queue';
  selectedId = null;
  loadedProfile = null;
  signature = '';
  feedback = '';
  templateFeedback = '';
  root.innerHTML = '<section class="id-panel" role="status">Loading ID requests…</section>';
  void refresh(true);
}
function openMember(id) {
  window.dispatchEvent(new CustomEvent('vccf-open-member-id', {detail:{memberId:id}}));
}
window.VCCFMemberIds = {mount, mountRequests, openMember, refresh};
['vccf-profile-photo-updated','vccf-member-updated','vccf-member-contact-updated','vccf-profile-linked','vccf-id-template-updated'].forEach(event => window.addEventListener(event, () => { void refresh(true); }));
window.addEventListener('focus', () => { void refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
setInterval(() => { void refresh(); }, 30000);
window.addEventListener('vccf-signed-out', () => {
  cardObserver?.disconnect();
  generation++;
  root = null;
  selectedId = loadedMember = loadedProfile = null;
  requests = [];
  templateSettings = null;
  signature = draftNotes = feedback = templateFeedback = '';
});
})();

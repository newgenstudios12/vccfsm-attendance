(()=>{
'use strict';
if(window.__VCCF_MEMBER_SAVE_ISOLATION_V2__)return;
window.__VCCF_MEMBER_SAVE_ISOLATION_V2__=true;
let suppress=false;
const originalRefresh=window.refresh;
const originalLoadDb=window.loadDb;
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const initials=n=>String(n||'?').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';
const role=()=>String(window.session?.role||window.profile?.role||window.userProfile?.role||'').trim().toLowerCase();
const manager=()=>role()==='admin'||role()==='area leader';
function avatar(photo,name){return photo?`<img src="${esc(photo)}" alt="${esc(name)}" style="width:44px;height:44px;min-width:44px;max-width:44px;height:44px;min-height:44px;max-height:44px;aspect-ratio:1/1;border-radius:50%;object-fit:cover;object-position:center;display:block">`:`<span class="member-avatar sm">${esc(initials(name))}</span>`}
window.refresh=function(...args){if(suppress){suppress=false;return Promise.resolve();}return typeof originalRefresh==='function'?originalRefresh.apply(this,args):Promise.resolve()};
window.loadDb=async function(...args){if(suppress)return;return typeof originalLoadDb==='function'?originalLoadDb.apply(this,args):undefined};
async function renderMembersOnly(){const t=document.getElementById('memberRows'),c=client();if(!t||!c)return;const [{data:members,error:me},{data:areas}]=await Promise.all([c.from('members').select('id,member_code,first_name,last_name,display_name,birth_date,address,area_id,member_type,photo_url,status,created_at').order('display_name'),c.from('areas').select('id,name').order('name')]);if(me)return;const amap=new Map((areas||[]).map(a=>[String(a.id),a.name]));window.db=window.db||{};window.db.members=(members||[]).map(m=>({id:m.id,memberCode:m.member_code||'',name:m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' '),birthday:m.birth_date||'',address:m.address||'',area:amap.get(String(m.area_id))||'',areaId:m.area_id||null,access:m.member_type||'Member',memberType:m.member_type||'Member',photo:m.photo_url||'',status:m.status||'active',createdAt:m.created_at||null}));t.innerHTML=window.db.members.map(m=>`<tr><td><div class="member-cell">${avatar(m.photo,m.name)}<div><b>${esc(m.name)}</b><br><small style="color:var(--muted)">${esc(m.memberCode||m.id)}</small></div></div></td><td>${esc(m.birthday)}</td><td><span class="tag">${esc(m.area||'No Designated Area')}</span></td><td>${esc(m.address)}</td><td>${esc(m.access)}</td><td><button class="btn secondary" onclick="showQR('${esc(m.id)}')">View</button></td><td>${manager()?`<button class="btn secondary" onclick="editMember('${esc(m.id)}')">Edit</button>`:'View only'}</td></tr>`).join('')||'<tr><td colspan="7" style="color:var(--muted)">No members found.</td></tr>';document.dispatchEvent(new CustomEvent('vccf-member-table-rendered'))}
window.addEventListener('vccf-members-changed',()=>{suppress=true;setTimeout(()=>{suppress=false},1500);setTimeout(()=>renderMembersOnly().catch(()=>{}),0)},{passive:true});
window.addEventListener('vccf-members-refresh',()=>renderMembersOnly().catch(()=>{}),{passive:true});
})();
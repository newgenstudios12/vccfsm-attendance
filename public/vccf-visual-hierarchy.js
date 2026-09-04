(()=>{
'use strict';
if(window.__VCCF_VISUAL_HIERARCHY__)return;
window.__VCCF_VISUAL_HIERARCHY__=true;
const style=document.createElement('style');
style.id='vccfVisualHierarchy';
style.textContent=`
:root{
  --section-outline:#d8dde6;
  --section-surface:#ffffff;
  --section-soft:#f7f8fa;
  --section-soft-2:#f1f3f6;
  --section-shadow:0 8px 22px rgba(15,23,42,.07),0 1px 2px rgba(15,23,42,.04);
  --section-shadow-hover:0 12px 30px rgba(15,23,42,.10),0 2px 4px rgba(15,23,42,.05);
}
:root[data-theme="dark"]{
  --section-outline:#3a404a;
  --section-surface:#1a1d23;
  --section-soft:#20242b;
  --section-soft-2:#262b33;
  --section-shadow:0 10px 28px rgba(0,0,0,.25),0 1px 2px rgba(0,0,0,.22);
  --section-shadow-hover:0 14px 34px rgba(0,0,0,.32),0 2px 5px rgba(0,0,0,.24);
}
html:not([data-theme="dark"]) body,
html:not([data-theme="dark"]) .layout{background:#f2f4f7!important}
html[data-theme="dark"] body,
html[data-theme="dark"] .layout{background:#0f1115!important}

/* Major section surfaces */
.app.show .card,
.app.show .panel,
.app.show .stat,
.app.show .cms-panel,
.app.show .notify-card,
.app.show .notify-inbox,
.app.show .push-only-item,
.app.show .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card{
  border:1px solid var(--section-outline)!important;
}
.app.show .card,
.app.show .panel,
.app.show .cms-panel,
.app.show .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card,
.app.show .notify-inbox{
  box-shadow:var(--section-shadow)!important;
}

/* Brand cue only on true section containers, not every small box */
.app.show .view > .card,
.app.show .view > .panel,
.app.show #church .cms-panel,
.app.show #notifications .notify-inbox,
.app.show #settings .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card{
  position:relative;
}
.app.show .view > .card::before,
.app.show .view > .panel::before,
.app.show #church .cms-panel::before,
.app.show #notifications .notify-inbox::before,
.app.show #settings .settings-card::before,
.app.show .attendance-action-card::before,
.app.show .attendance-records::before,
.app.show .member-profile-card::before,
.app.show .member-metric-card::before{
  content:"";
  position:absolute;
  top:0;
  left:18px;
  right:18px;
  height:3px;
  border-radius:0 0 999px 999px;
  background:linear-gradient(90deg,var(--brand),var(--brand2));
  opacity:.72;
  pointer-events:none;
}

/* Secondary information blocks */
.app.show .stat,
.app.show .cms-stat,
.app.show .metric,
.app.show .giving-item,
.app.show .m360-box,
.app.show .m360-summary,
.app.show .notify-card,
.app.show .push-only-item,
.app.show .service-summary-card,
.app.show .event-summary-card{
  background:var(--section-surface)!important;
  border:1px solid var(--section-outline)!important;
  box-shadow:0 2px 8px rgba(15,23,42,.045)!important;
}
.app.show .m360-box,
.app.show .m360-summary,
.app.show .giving-item,
.app.show .metric{
  background:var(--section-soft)!important;
  box-shadow:none!important;
}
html[data-theme="dark"] .app.show .stat,
html[data-theme="dark"] .app.show .cms-stat,
html[data-theme="dark"] .app.show .notify-card,
html[data-theme="dark"] .app.show .push-only-item{
  box-shadow:0 3px 10px rgba(0,0,0,.20)!important;
}

/* Stronger section rhythm */
.app.show .stats,
.app.show .grid,
.app.show .cms-grid,
.app.show .cms-content,
.app.show .cms-shell,
.app.show .cms-stats,
.app.show .m360-grid,
.app.show .m360-summary-grid,
.app.show .giving-summary,
.app.show .attendance-workflow,
.app.show .notify-grid,
.app.show .push-only-panel{
  gap:16px!important;
}
.app.show .view{padding-bottom:24px}

/* Clear headers inside cards */
.app.show .cms-panel-head,
.app.show .members-head,
.app.show .attendance-card-title,
.app.show .attendance-records-head,
.app.show .notify-card-head,
.app.show .notify-inbox-head,
.app.show .dashboard-announcement-head,
.app.show .m360-head{
  padding-bottom:13px;
  margin-bottom:16px!important;
  border-bottom:1px solid var(--section-outline);
}
.app.show .cms-panel-head h3,
.app.show .attendance-card-title h2,
.app.show .attendance-records h2,
.app.show .notify-card h3,
.app.show .notify-inbox h3,
.app.show .settings-card h2,
.app.show .settings-card h3{
  letter-spacing:-.015em;
}

/* Tables and rows sit on a quieter inner layer */
.app.show .table-wrap{
  border:1px solid var(--section-outline);
  border-radius:13px;
  overflow:auto;
  background:var(--section-surface);
}
.app.show .table th{
  background:var(--section-soft);
  border-bottom:1px solid var(--section-outline)!important;
}
.app.show .table td{border-bottom-color:var(--section-outline)!important}
.app.show .table tbody tr:last-child td{border-bottom:0}
.app.show .cms-list-row,
.app.show .m360-row,
.app.show .dashboard-announcement-row{
  border-bottom-color:var(--section-outline)!important;
}

/* Inputs should visually belong to the section without disappearing into it */
.app.show input,
.app.show select,
.app.show textarea{
  border-color:var(--section-outline)!important;
}
.app.show input:focus,
.app.show select:focus,
.app.show textarea:focus{
  border-color:var(--brand)!important;
  box-shadow:0 0 0 3px var(--brand-soft)!important;
}

/* Small hover cue for clickable cards/rows */
@media (hover:hover){
  .app.show .member-row:hover td{background:var(--section-soft)!important}
  .app.show .notify-card:hover,
  .app.show .push-only-item:hover{box-shadow:var(--section-shadow-hover)!important}
}

/* Mobile keeps separation without wasting screen space */
@media(max-width:700px){
  .app.show .stats,
  .app.show .grid,
  .app.show .cms-grid,
  .app.show .cms-content,
  .app.show .cms-shell,
  .app.show .cms-stats,
  .app.show .m360-grid,
  .app.show .m360-summary-grid,
  .app.show .giving-summary,
  .app.show .attendance-workflow,
  .app.show .notify-grid,
  .app.show .push-only-panel{gap:12px!important}
  .app.show .view > .card::before,
  .app.show .view > .panel::before,
  .app.show #church .cms-panel::before,
  .app.show #notifications .notify-inbox::before,
  .app.show #settings .settings-card::before,
  .app.show .attendance-action-card::before,
  .app.show .attendance-records::before,
  .app.show .member-profile-card::before,
  .app.show .member-metric-card::before{left:14px;right:14px}
  .app.show .cms-panel-head,
  .app.show .members-head,
  .app.show .attendance-card-title,
  .app.show .attendance-records-head,
  .app.show .notify-card-head,
  .app.show .notify-inbox-head,
  .app.show .dashboard-announcement-head,
  .app.show .m360-head{padding-bottom:11px;margin-bottom:13px!important}
}
`;
document.head.appendChild(style);
})();

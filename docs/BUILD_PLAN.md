# VCCF Santa Maria — Rebuild Plan

## Goal
Build one clean, responsive Church Attendance & Member Management application with one authentication boundary, one navigation system, and one source of truth per business workflow.

## Phase 1 — Foundation and permissions
- Keep the existing Supabase project and accounts.
- Roles: admin, pastor, area_leader, member, guest.
- Establish canonical data domains: members, areas, attendance, special events, giving, Sunday/Event summaries, summary photos, church-management records.
- Preserve working QR/profile-photo behavior as a requirement, but implement it once in the new application.
- Define visibility/edit/delete permissions before UI work.
- Use audit logging for privileged changes.

## Phase 2 — Authentication
- One Supabase browser client.
- One login submit handler.
- Email or established username convention.
- Persisted session with bounded login timeout.
- No pre-auth database reads that can block the login screen.
- Admin account creation/deletion through the established server-side account-management path.

## Phase 3 — App shell
- Responsive desktop/tablet/mobile shell.
- VCCF logo in login and navigation header.
- Single navigation tree; no duplicate modules or handlers.
- Church Management dropdown must be accessible from the main navigation.

## Phase 4 — Members
- Member profile photo.
- Member QR code.
- Print individual QR and print QR by area.
- Address Type: Santa Maria, Laguna or Other.
- Santa Maria, Laguna => Barangay dropdown using the municipality barangay list.
- Admin/Pastor: edit member details.
- Area Leader: edit only permitted members in their area.
- Member view: own permitted information.
- Member profile combines attendance performance/history and giving summary.

## Phase 5 — Attendance
- QR Attendance.
- Manual Attendance.
- One activity-type selector: Sunday Service, Bible Study, Special Event.
- No standalone Absent entry workflow.
- Area leaders can adjust/edit dates for their permitted area members.
- Special Event attendance links to Events.

## Phase 6 — Events
- Event creation/editing.
- Event registration.
- Special-event attendance.
- Event summary submission.

## Phase 7 — Sunday/Event summaries
One submitted record contains:
- date
- summary type/title
- attendance count
- member base
- attendance rate
- tithes
- offerings
- notes
- uploaded photos

The same submitted record is used by Attendance, Dashboard, and member-linked history. Photos in the Dashboard carousel come only from submitted summaries/events.

## Phase 8 — Dashboard
- Latest submitted Sunday/Event summary as the opener.
- Photo carousel sourced from recent submitted summaries/events.
- Horizontal Sunday attendance bars.
- Upcoming events.
- Summary statistics linked to the same submitted-summary records.

## Phase 9 — Church Management
- Areas
- Ministries
- Pastoral Care
- Prayer Requests
- Event Registrations
- Member Documents
- Admin/Pastor delete controls.
- Area-limited permissions where applicable.

## Phase 10 — Reports
Use the established Aug 27 workbook formats as the report/export baseline for Sunday attendance and Special Events rather than introducing a new template.

## Phase 11 — QA and release
Test as complete workflows before promotion:
1. Login -> dashboard
2. Members -> profile -> QR/photo -> edit permissions
3. Attendance -> QR/manual -> type -> event linkage
4. Summary submission -> photos -> Attendance view -> Dashboard carousel
5. Member profile -> attendance + giving
6. Church Management -> permissions/delete
7. Reports -> Aug 27-compatible exports
8. Desktop/mobile responsiveness

## Non-negotiable architecture rules
- One login implementation.
- One Supabase client.
- One Members module.
- One Attendance module.
- One Events module.
- One Sunday/Event summary model.
- No duplicate generation of the same functionality.
- Do not change working authentication while adding unrelated features.

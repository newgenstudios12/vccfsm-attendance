# Module health audit — 2026-09-16

## Confirmed shared issue
The signed-in Church Management engine can be asked to render while its initial data load is still in progress. Its existing `renderActive()` path calls `loadAll().then(renderActive)`, while `loadAll()` returns immediately when `loading === true`. That can create a rapid re-render loop and make a navigation click appear unresponsive.

The same engine backs these routes:
- Church Services
- Church Management Overview
- Areas
- Ministries
- Pastoral Care
- Reports
- Documents
- Access
- Events
- Leadership
- Prayer Requests
- Announcements
- Activity Log

## Fix
`vccf-module-health.js` wraps the existing Church Management navigation API without replacing the modules. It:
- waits for an in-flight CMS load to finish before refreshing/rendering;
- synchronizes CMS data once under the authenticated user instead of trusting a pre-login load;
- prevents a second concurrent synchronization from starting;
- catches renderer failures and provides an in-module Retry action instead of leaving a blank/dead screen;
- does not remount or rewrite standalone modules such as Gallery, Sermons, Giving, Pledges, Notifications, or Digital ID.

## Regression scope
No database schema changes. No role/RLS changes. No changes to Attendance, Giving/Tithes, Digital ID, Gallery, Sermons, Worship, guest access, or finance permissions.

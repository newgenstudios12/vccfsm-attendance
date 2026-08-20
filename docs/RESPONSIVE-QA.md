# VCCF Connect Responsive QA Procedure

Use this checklist before approving UI changes.

## Viewports
- 375×667 — small phone
- 390×844 — modern phone
- 768×1024 — tablet
- 1024×768 — small desktop/tablet landscape
- 1440×900 — desktop

## Pages to smoke-test
- Login / authentication
- Dashboard
- Members
- Attendance / QR scanner / manual attendance
- Gallery
- Sermons
- Chat
- My Profile
- Settings

## Layout checks
- No horizontal page scrolling at any viewport.
- Navigation remains usable; on phones it uses the bottom navigation rail.
- Headings, cards, tables, forms, and buttons stay within the viewport.
- Tables scroll horizontally inside their table container instead of moving the whole page.
- Images, videos, QR canvases, and dialogs stay inside their containers.
- Long names, addresses, filenames, and messages wrap instead of forcing overflow.
- Modal dialogs fit within the viewport and can scroll internally.
- Chat list stays independent from the active conversation; only the message pane scrolls.
- Composer stays usable on narrow screens.
- Sermon cards and upload controls stack cleanly on phones.

## Interaction checks
- Tap targets are comfortably clickable.
- Inputs remain visible when the mobile keyboard opens.
- Navigation can switch pages without leaving an active page horizontally scrolled.
- Opening/closing dialogs does not create page-level horizontal overflow.
- Dark mode remains legible at all viewports.

## Deployment verification
- Confirm the production host reports a deployment for the latest `main` commit.
- Confirm the production deployment SHA matches the GitHub `main` SHA before calling the release complete.
- Do not create repeated trigger commits; one production push should be enough.

## Release rule
A UI change should not be considered responsive-ready until it passes the viewport and page smoke tests above in a Chromium browser with device emulation enabled and the production deployment SHA has been verified.

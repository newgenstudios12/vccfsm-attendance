# VCCF Santa Maria mobile build plan

This branch isolates Capacitor work from production.

## Current web structure

The application is a static web app served from `public/`, with `public/index.html` as the entry point and feature scripts/assets loaded from the same directory. Supabase configuration and migrations are kept separately under `supabase/`.

## Setup

```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

`webDir` is intentionally `public`, so Capacitor packages the same app currently served on the web. No production deployment configuration is changed by this branch.

## Test checklist before merging

1. Login and logout
2. Supabase session persistence
3. Member directory and attendance visibility
4. QR/camera flows
5. Profile avatar upload
6. Sermon/gallery file viewing and downloads
7. Chat layout and scrolling
8. Android back button
9. iPhone safe areas
10. Small-phone, tablet, and desktop-sized layouts

## Store builds

Android: open the generated `android/` project in Android Studio and produce a signed App Bundle (`.aab`).

iOS: open the generated `ios/` project in Xcode, test through TestFlight, then submit through App Store Connect.

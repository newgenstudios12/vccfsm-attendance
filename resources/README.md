# Mobile app assets

Place the prepared VCCF icon source at:

- `resources/icon.png` — 1024×1024 PNG, used as the master Android/iOS icon source
- `resources/splash.png` — 2732×2732 PNG, used as the splash artwork source

After the assets are present and dependencies are installed:

```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

The generated `android/` and `ios/` projects should remain on the `mobile/capacitor` branch until device testing is complete. Do not merge this branch into `main` until Android login, Supabase access, file upload, QR/attendance, chat, deep links, and safe-area behavior have been verified.

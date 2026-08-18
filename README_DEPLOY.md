# VCCF static Vercel deployment

This version is intentionally build-free. Vercel should serve `index.html` directly from the repository root.

Before deploying, edit `vccf-config.js` in GitHub and replace:

`__PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE__`

with the VCCF project's **publishable key**. Do not use a service-role or secret key.

Vercel settings:
- Framework Preset: Other (or leave automatic)
- Build Command: leave blank / disabled
- Output Directory: leave blank / root

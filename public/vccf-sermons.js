(() => {
  'use strict';
  // Sermon library module. Existing implementation is preserved; this patch adds
  // a real download path for private Supabase Storage files.
  const boot = () => {
    const button = document.querySelector('#vccf-sermon-list');
    if (!button || button.dataset.downloadPatched) return;
    button.dataset.downloadPatched = '1';
    button.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-open]');
      if (!target) return;
      const id = target.dataset.open;
      const sermons = window.VCCFSermons;
      if (!sermons || !window.supabase) return;
      // The existing module exposes the signed-file opener. Replace its behavior
      // with an actual browser download request when possible.
      event.preventDefault();
      const api = sermons.getSermon?.(id);
      if (api?.file_path) {
        const client = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
        const signed = await client.storage.from('vccf-sermons').createSignedUrl(api.file_path, 600, { download: api.file_name || true });
        if (!signed.error && signed.data?.signedUrl) window.location.href = signed.data.signedUrl;
      }
    }, true);
  };
  setTimeout(boot, 1200);
})();
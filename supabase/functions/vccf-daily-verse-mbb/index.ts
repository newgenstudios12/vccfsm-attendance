import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const legacyServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const secretMapRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
let serviceKey = legacyServiceRole || '';
try {
  if (!serviceKey && secretMapRaw) serviceKey = JSON.parse(secretMapRaw)?.default || '';
} catch (_) {
  // Fall through to the explicit configuration error below.
}

if (!SUPABASE_URL || !serviceKey) {
  throw new Error('Supabase service configuration is unavailable.');
}

const service = createClient(SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BIBLE_BRAIN_BASE = 'https://4.dbt.io/api';
const BIBLE_ID = 'TGLPBS';
const BIBLE_BRAIN_API_KEY = Deno.env.get('BIBLE_BRAIN_API_KEY') || '';
const MANILA_TZ = 'Asia/Manila';
const PRODUCTION_ORIGINS = new Set([
  'https://vccfsm-attendance.vercel.app',
  'https://vccfsm-attendance-newgenstudios12s-projects.vercel.app',
  'https://vccfsm-attendance-git-main-newgenstudios12s-projects.vercel.app',
]);

const BOOKS: Record<string, string> = {
  genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
  joshua: 'JOS', judges: 'JDG', ruth: 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
  '1 kings': '1KI', '2 kings': '2KI', '1 chronicles': '1CH', '2 chronicles': '2CH',
  ezra: 'EZR', nehemiah: 'NEH', esther: 'EST', job: 'JOB', psalm: 'PSA', psalms: 'PSA',
  proverbs: 'PRO', ecclesiastes: 'ECC', 'song of solomon': 'SNG', 'song of songs': 'SNG',
  isaiah: 'ISA', jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN',
  hosea: 'HOS', joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC',
  nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC', malachi: 'MAL',
  matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT', romans: 'ROM',
  '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL', ephesians: 'EPH',
  philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH', '2 thessalonians': '2TH',
  '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT', philemon: 'PHM', hebrews: 'HEB',
  james: 'JAS', '1 peter': '1PE', '2 peter': '2PE', '1 john': '1JN', '2 john': '2JN',
  '3 john': '3JN', jude: 'JUD', revelation: 'REV', revelations: 'REV',
};

function todayPH(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function normalizeBook(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseReference(reference: string) {
  const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–—]\s*(\d+))?$/);
  if (!match) return null;
  const [, rawBook, chapterRaw, startRaw, endRaw] = match;
  const bookId = BOOKS[normalizeBook(rawBook)];
  if (!bookId) return null;
  const chapter = Number(chapterRaw);
  const verseStart = Number(startRaw);
  const verseEnd = Number(endRaw || startRaw);
  if (!Number.isInteger(chapter) || !Number.isInteger(verseStart) || !Number.isInteger(verseEnd)) return null;
  if (chapter < 1 || verseStart < 1 || verseEnd < verseStart) return null;
  return { bookId, chapter, verseStart, verseEnd };
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  if (PRODUCTION_ORIGINS.has(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return '';
}

function headers(origin: string | null) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'vary': 'Origin',
    ...(origin ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    } : {}),
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

async function dailyFallback() {
  const date = todayPH();
  const { data, error } = await service.rpc('vccf_daily_bible_verse', { p_date: date });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reference) throw new Error('No Daily Verse reference is configured.');
  return {
    verse_date: row.verse_date || date,
    reference: String(row.reference),
    verse_text: String(row.verse_text || ''),
    translation: String(row.translation || 'KJV'),
  };
}

async function fetchMbb(reference: string) {
  const parsed = parseReference(reference);
  if (!parsed) throw new Error(`Unsupported Bible reference format: ${reference}`);

  const url = new URL(`${BIBLE_BRAIN_BASE}/bible/${BIBLE_ID}/verses/${parsed.bookId}/${parsed.chapter}`);
  url.searchParams.set('key', BIBLE_BRAIN_API_KEY);
  url.searchParams.set('v', '4');
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'follow',
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = JSON.parse(text); } catch (_) { /* handled below */ }

  if (!response.ok) {
    const apiMessage = payload?.error?.message || payload?.message || `Bible Brain returned ${response.status}`;
    throw new Error(apiMessage);
  }

  const verses = Array.isArray(payload?.data) ? payload.data : [];
  const selected = verses.filter((item: any) => {
    const start = Number(item?.verse_start_alt ?? item?.verse_start ?? item?.verse_sequence);
    const end = Number(item?.verse_end_alt ?? item?.verse_end ?? start);
    return Number.isFinite(start) && start <= parsed.verseEnd && Math.max(start, Number.isFinite(end) ? end : start) >= parsed.verseStart;
  });

  const verseText = selected
    .map((item: any) => String(item?.verse_text || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!verseText) throw new Error('MBB text was not returned for today\'s reference.');

  return verseText;
}

Deno.serve(async (req: Request) => {
  const origin = allowedOrigin(req);
  if (origin === '') return json({ error: 'Origin not allowed.' }, 403, null);
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: headers(origin) });
  if (req.method !== 'GET') return json({ error: 'GET required.' }, 405, origin);

  try {
    const fallback = await dailyFallback();

    if (!BIBLE_BRAIN_API_KEY) {
      return json({
        ok: false,
        configured: false,
        source: 'KJV fallback',
        ...fallback,
        notice: 'Bible Brain API key has not been configured yet.',
      }, 200, origin);
    }

    try {
      const verseText = await fetchMbb(fallback.reference);
      return json({
        ok: true,
        configured: true,
        verse_date: fallback.verse_date,
        reference: fallback.reference,
        verse_text: verseText,
        translation: 'MBBTAG',
        bible_id: BIBLE_ID,
        source: 'Bible Brain / Faith Comes By Hearing',
        publisher: 'Philippine Bible Society',
        copyright_notice: 'Tagalog Bible Text © 2012 Philippine Bible Society',
        terms_url: 'https://www.faithcomesbyhearing.com/bible-brain/terms-conditions',
        license_url: 'https://www.faithcomesbyhearing.com/bible-brain/license',
      }, 200, origin);
    } catch (apiError: any) {
      console.error('[vccf-daily-verse-mbb] Bible Brain fetch failed:', apiError?.message || apiError);
      return json({
        ok: false,
        configured: true,
        source: 'KJV fallback',
        ...fallback,
        notice: 'Authorized MBB source was unavailable, so the public-domain fallback was used.',
      }, 200, origin);
    }
  } catch (error: any) {
    console.error('[vccf-daily-verse-mbb]', error);
    return json({ error: error?.message || String(error) }, 500, origin);
  }
});

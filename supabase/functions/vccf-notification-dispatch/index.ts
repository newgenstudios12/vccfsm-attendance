import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = 'BB_9JJyvvN72cV8Xg2TsEOWFeS4LRb__Xz8SYJqUrU7p8UjE_CXSXP9OZC10jyLn7EMHs5F_gy-kFrT4PtiE8xM';
const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-vccf-cron-secret',
  },
});
const manilaDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const manilaTime = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const manilaWeekday = (d = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(d);
const manilaMonth = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(d);
const manilaDayNumber = (d = new Date()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', day: 'numeric' }).format(d));
const cleanTime = (v: string | null) => String(v || '').slice(0, 5);

type Caller = { kind: 'cron' } | { kind: 'user'; user: any; profile: any };

async function config() {
  const r = await service.rpc('vccf_push_private_config');
  if (r.error) throw r.error;
  const row = Array.isArray(r.data) ? r.data[0] : r.data;
  if (!row?.vapid_private_key || !row?.cron_secret) throw new Error('Push configuration is incomplete.');
  return row as { vapid_private_key: string; cron_secret: string };
}

async function caller(req: Request, cronSecret: string): Promise<Caller | null> {
  const internal = req.headers.get('x-vccf-cron-secret');
  if (internal && internal === cronSecret) return { kind: 'cron' };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const u = await service.auth.getUser(token);
  if (u.error || !u.data.user) return null;
  const p = await service.from('profiles').select('user_id,role,member_id,area_id').eq('user_id', u.data.user.id).maybeSingle();
  if (p.error || !p.data) return null;
  return { kind: 'user', user: u.data.user, profile: p.data };
}

async function allProfiles() {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const r = await service.from('profiles')
      .select('user_id,role,member_id,area_id')
      .not('user_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (r.error) throw r.error;
    rows.push(...(r.data || []));
    if ((r.data || []).length < pageSize) break;
  }
  return rows;
}

async function allEnabledSubscriptions() {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const r = await service.from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth_key')
      .eq('enabled', true)
      .range(from, from + pageSize - 1);
    if (r.error) throw r.error;
    rows.push(...(r.data || []));
    if ((r.data || []).length < pageSize) break;
  }
  return rows;
}

async function targetUserIds(a: any) {
  if (a.audience === 'User' && a.target_user_id) return [String(a.target_user_id)];

  const profiles = await allProfiles();
  if (a.audience === 'All') {
    return [...new Set(profiles.map((p: any) => String(p.user_id)).filter(Boolean))];
  }
  if (a.audience === 'Leaders') {
    return [...new Set(profiles
      .filter((p: any) => ['admin', 'pastor', 'area_leader', 'ministry_leader'].includes(String(p.role)))
      .map((p: any) => String(p.user_id)).filter(Boolean))];
  }
  if (a.audience === 'Area') {
    return [...new Set(profiles
      .filter((p: any) => p.area_id && p.area_id === a.area_id)
      .map((p: any) => String(p.user_id)).filter(Boolean))];
  }
  if (a.audience === 'Ministry') {
    const memberIds = profiles.map((p: any) => p.member_id).filter(Boolean);
    if (!memberIds.length || !a.ministry_id) return [];
    const [mm, lead] = await Promise.all([
      service.from('member_ministries').select('member_id,ministry_id').eq('ministry_id', a.ministry_id).in('member_id', memberIds),
      service.from('church_leadership').select('member_id,ministry_id,is_active').eq('ministry_id', a.ministry_id).eq('is_active', true).in('member_id', memberIds),
    ]);
    if (mm.error) throw mm.error;
    if (lead.error) throw lead.error;
    const mids = new Set([...(mm.data || []).map((x: any) => x.member_id), ...(lead.data || []).map((x: any) => x.member_id)]);
    return [...new Set(profiles
      .filter((p: any) => p.member_id && mids.has(p.member_id))
      .map((p: any) => String(p.user_id)).filter(Boolean))];
  }
  return [];
}

async function targetSubscriptions(userIds: string[]) {
  if (!userIds.length) return [];
  const allowed = new Set(userIds);
  const subs = await allEnabledSubscriptions();
  return subs.filter((s: any) => allowed.has(String(s.user_id)));
}

function notificationKind(table: string, a: any) {
  const source = String(a.source_type || '').toLowerCase();
  const url = String(a.push_url || '').toLowerCase();
  const title = String(a.title || '').toLowerCase();
  if (table === 'church_announcements') return 'announcement';
  if (source === 'sermon') return 'sermon';
  if (source === 'church_event') return 'event';
  if (source === 'worship_assignment') return 'worship';
  if (source === 'sunday_attendance') return 'attendance';
  if (source === 'birthday') return 'birthday';
  if (source === 'daily_verse' || url.includes('daily-verse') || title.startsWith("today's word")) return 'verse';
  return 'push';
}

async function automationSettings() {
  const r = await service.from('notification_automation_settings').select('automation_key,enabled');
  if (r.error) {
    console.error('automation settings unavailable', r.error.message);
    return new Map<string, boolean>();
  }
  return new Map<string, boolean>((r.data || []).map((x: any) => [String(x.automation_key), x.enabled === true]));
}

function automationKey(a: any) {
  const source = String(a.source_type || '').toLowerCase();
  const key = String(a.source_key || '').toLowerCase();
  const url = String(a.push_url || '').toLowerCase();
  const title = String(a.title || '').toLowerCase();
  if (source === 'sermon') return 'new_sermon';
  if (source === 'church_event' && key === 'new_event') return 'new_event';
  if (source === 'church_event' && key === 'upcoming_reminder') return 'event_reminder';
  if (source === 'worship_assignment' && key === 'assignment_notice') return 'worship_assignment';
  if (source === 'worship_assignment' && (key.startsWith('service_reminder:') || key.startsWith('monday_reminder:'))) return 'worship_reminder';
  if (source === 'sunday_attendance') return 'sunday_attendance_reminder';
  if (source === 'birthday') return 'birthday_greeting';
  if (source === 'daily_verse' || url.includes('daily-verse') || title.startsWith("today's word")) return 'daily_verse';
  return null;
}

function automationAllowed(a: any, settings: Map<string, boolean>) {
  const key = automationKey(a);
  if (!key) return true;
  if (settings.size === 0) return true;
  return settings.get('master') !== false && settings.get(key) !== false;
}

async function saveInboxRows(table: string, a: any, userIds: string[]) {
  if (!userIds.length) return 0;
  const rows = userIds.map(user_id => ({
    user_id,
    title: a.title || 'VCCF Connect',
    body: a.body || 'New notification',
    kind: notificationKind(table, a),
    is_read: false,
    action_url: a.push_url || '/',
    source_type: a.source_type || table,
    source_id: a.source_id || a.id || null,
    source_key: a.source_key || null,
  }));
  const chunkSize = 500;
  let savedCount = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const saved = await service.from('vccf_notifications').insert(chunk);
    if (saved.error) {
      console.error('inbox insert failed', saved.error.message);
      continue;
    }
    savedCount += chunk.length;
  }
  return savedCount;
}

async function sendRow(table: string, a: any, privateKey: string) {
  const recipientIds = await targetUserIds(a);
  const subs = await targetSubscriptions(recipientIds);
  webpush.setVapidDetails('mailto:newgenstudios12@gmail.com', VAPID_PUBLIC, privateKey);
  const payload = JSON.stringify({
    title: a.title || 'VCCF Connect',
    body: a.body || 'New notification',
    url: a.push_url || '/',
    tag: `${table}-${a.id}`,
    data: { source_table: table, id: a.id, source_type: a.source_type || null, source_id: a.source_id || null },
  });

  let sent = 0, failed = 0, removed = 0;
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 86400 });
      sent++;
    } catch (error: any) {
      failed++;
      const status = Number(error?.statusCode || 0);
      if (status === 404 || status === 410) {
        await service.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        console.error('push failed', status, error?.message || error);
      }
    }
  }));

  const inbox = await saveInboxRows(table, a, recipientIds);
  await service.from(table).update({ last_push_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', a.id);
  return { source: table, id: a.id, recipients: recipientIds.length, sent, failed, removed, inbox };
}

async function senderName(senderId: string) {
  const p = await service.from('profiles').select('display_name,member_id').eq('user_id', senderId).maybeSingle();
  if (p.error) throw p.error;
  if (p.data?.display_name) return String(p.data.display_name);
  if (p.data?.member_id) {
    const m = await service.from('members').select('display_name,first_name,last_name').eq('id', p.data.member_id).maybeSingle();
    if (!m.error && m.data) return String(m.data.display_name || [m.data.first_name, m.data.last_name].filter(Boolean).join(' ') || 'VCCF Member');
  }
  return 'VCCF Member';
}

async function sendChat(messageId: string, privateKey: string, who: Caller) {
  const mr = await service.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('id', messageId).maybeSingle();
  if (mr.error) throw mr.error;
  if (!mr.data) throw new Error('Chat message not found.');
  const message = mr.data;
  if (who.kind === 'user' && message.sender_id !== who.user.id) throw new Error('You can only dispatch your own chat message.');

  const cm = await service.from('conversation_members').select('user_id').eq('conversation_id', message.conversation_id);
  if (cm.error) throw cm.error;
  const recipients = [...new Set((cm.data || []).map((x: any) => x.user_id).filter((id: any) => id && id !== message.sender_id))] as string[];
  if (!recipients.length) return { source: 'messages', id: message.id, sent: 0, failed: 0, removed: 0, inbox: 0, recipients: 0 };

  const name = await senderName(message.sender_id);
  const preview = String(message.body || 'New message').replace(/\s+/g, ' ').trim().slice(0, 180) || 'New message';
  const title = `New message from ${name}`;
  const url = `/?chat=${encodeURIComponent(message.conversation_id)}`;

  const inboxRows = recipients.map(user_id => ({
    user_id,
    title,
    body: preview,
    kind: 'chat',
    is_read: false,
    action_url: url,
    source_type: 'message',
    source_id: message.id,
    source_key: 'new_message',
  }));
  const inbox = await service.from('vccf_notifications').insert(inboxRows);
  if (inbox.error) console.error('chat inbox insert failed', inbox.error.message);

  const sr = await service.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth_key').eq('enabled', true).in('user_id', recipients);
  if (sr.error) throw sr.error;
  const subs = sr.data || [];
  webpush.setVapidDetails('mailto:newgenstudios12@gmail.com', VAPID_PUBLIC, privateKey);
  const payload = JSON.stringify({
    title,
    body: preview,
    url,
    tag: `vccf-chat-${message.conversation_id}`,
    renotify: true,
    data: { source_table: 'messages', id: message.id, conversation_id: message.conversation_id, kind: 'chat' },
  });

  let sent = 0, failed = 0, removed = 0;
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 86400 });
      sent++;
    } catch (error: any) {
      failed++;
      const status = Number(error?.statusCode || 0);
      if (status === 404 || status === 410) {
        await service.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        console.error('chat push failed', status, error?.message || error);
      }
    }
  }));
  return { source: 'messages', id: message.id, conversation_id: message.conversation_id, recipients: recipients.length, sent, failed, removed, inbox: inbox.error ? 0 : recipients.length };
}

function isDue(a: any, now = new Date()) {
  if (!a.is_published || !a.push_enabled) return false;
  if (a.publish_at && new Date(a.publish_at) > now) return false;
  if (a.expires_at && new Date(a.expires_at) <= now) return false;
  if (a.recurrence === 'daily') {
    if (!a.daily_time) return false;
    const last = a.last_push_at ? manilaDay(new Date(a.last_push_at)) : null;
    return last !== manilaDay(now) && cleanTime(a.daily_time) <= manilaTime(now);
  }
  if (a.recurrence === 'weekly') {
    if (!a.daily_time || !a.publish_at) return false;
    const scheduledWeekday = manilaWeekday(new Date(a.publish_at));
    if (manilaWeekday(now) !== scheduledWeekday) return false;
    const last = a.last_push_at ? manilaDay(new Date(a.last_push_at)) : null;
    return last !== manilaDay(now) && cleanTime(a.daily_time) <= manilaTime(now);
  }
  if (a.recurrence === 'monthly') {
    if (!a.daily_time || !a.publish_at) return false;
    const scheduledDay = manilaDayNumber(new Date(a.publish_at));
    if (manilaDayNumber(now) !== scheduledDay) return false;
    const lastMonth = a.last_push_at ? manilaMonth(new Date(a.last_push_at)) : null;
    return lastMonth !== manilaMonth(now) && cleanTime(a.daily_time) <= manilaTime(now);
  }
  return !a.last_push_at;
}

function canManualSend(who: Caller, a: any) {
  if (who.kind === 'cron') return true;
  const role = String(who.profile.role || '');
  if (role === 'admin' || role === 'pastor') return true;
  return role === 'area_leader' && a.audience === 'Area' && a.area_id && a.area_id === who.profile.area_id;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-vccf-cron-secret' } });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const cfg = await config();
    const who = await caller(req, cfg.cron_secret);
    if (!who) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));

    if (body.mode === 'chat') {
      const messageId = String(body.message_id || '');
      if (!messageId) return json({ error: 'message_id required' }, 400);
      return json({ ok: true, result: await sendChat(messageId, cfg.vapid_private_key, who) });
    }

    if (body.mode === 'due') {
      if (who.kind !== 'cron') return json({ error: 'Scheduled dispatch is internal only.' }, 403);
      const [ann, push, auto] = await Promise.all([
        service.from('church_announcements').select('*').eq('is_published', true).eq('push_enabled', true).order('publish_at', { ascending: true }).limit(500),
        service.from('push_notifications').select('*').eq('is_published', true).eq('push_enabled', true).order('publish_at', { ascending: true }).limit(500),
        automationSettings(),
      ]);
      if (ann.error) throw ann.error;
      if (push.error) throw push.error;
      const jobs = [
        ...(ann.data || []).filter(isDue).map((a: any) => ['church_announcements', a] as const),
        ...(push.data || []).filter((a: any) => isDue(a) && automationAllowed(a, auto)).map((a: any) => ['push_notifications', a] as const),
      ];
      const results = [];
      for (const [table, a] of jobs) results.push(await sendRow(table, a, cfg.vapid_private_key));
      return json({ ok: true, due: jobs.length, results });
    }

    const table = body.source === 'push' || body.table === 'push_notifications' ? 'push_notifications' : 'church_announcements';
    const id = String(body.notification_id || body.announcement_id || '');
    if (!id) return json({ error: 'notification_id required' }, 400);
    const ar = await service.from(table).select('*').eq('id', id).maybeSingle();
    if (ar.error || !ar.data) return json({ error: 'Notification not found' }, 404);
    if (!canManualSend(who, ar.data)) return json({ error: 'You do not have permission to push this notification.' }, 403);
    if (!ar.data.is_published || !ar.data.push_enabled) return json({ error: 'Notification is not enabled for push.' }, 400);
    return json({ ok: true, result: await sendRow(table, ar.data, cfg.vapid_private_key) });
  } catch (error: any) {
    console.error(error);
    return json({ error: error?.message || String(error) }, 500);
  }
});

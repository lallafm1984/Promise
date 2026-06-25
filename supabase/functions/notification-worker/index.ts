// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function parseLimit(request) {
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);

  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, rawLimit));
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assertWorkerSecret(request) {
  const expectedSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET') ?? Deno.env.get('PUSH_WORKER_SECRET');

  if (!expectedSecret) {
    return true;
  }

  const providedSecret =
    request.headers.get('x-notification-worker-secret') ?? request.headers.get('x-push-worker-secret');

  return providedSecret === expectedSecret;
}

async function sendExpoPush(event) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: event.token,
      title: event.title,
      body: event.body,
      data: event.data ?? {},
      sound: 'default',
      priority: 'high',
      channelId: 'whenbollae-default',
    }),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Expo push request failed: ${response.status} ${responseText}`);
  }

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`Expo push response was not JSON: ${responseText}`);
  }

  const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;

  if (ticket?.status === 'error') {
    const details = ticket.details?.error ? ` (${ticket.details.error})` : '';
    throw new Error(`${ticket.message ?? 'Expo push ticket failed'}${details}`);
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  if (!assertWorkerSecret(request)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'missing_supabase_service_role_configuration' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: events, error: claimError } = await supabase.rpc('claim_notification_events', {
    p_limit: parseLimit(request),
  });

  if (claimError) {
    console.error('Failed to claim notification events', claimError);
    return jsonResponse({ error: getErrorMessage(claimError) }, 500);
  }

  let delivered = 0;
  let failed = 0;
  const failures = [];

  for (const event of events ?? []) {
    try {
      await sendExpoPush(event);
      const { error } = await supabase.rpc('mark_notification_event_delivered', {
        p_event_id: event.id,
      });

      if (error) {
        throw error;
      }

      delivered += 1;
    } catch (error) {
      failed += 1;
      const message = getErrorMessage(error);
      failures.push({ id: event.id, error: message });

      const { error: markFailedError } = await supabase.rpc('mark_notification_event_failed', {
        p_event_id: event.id,
        p_error: message,
      });

      if (markFailedError) {
        console.error('Failed to mark notification event as failed', markFailedError);
      }
    }
  }

  return jsonResponse({
    claimed: events?.length ?? 0,
    delivered,
    failed,
    failures: failures.slice(0, 10),
  });
});

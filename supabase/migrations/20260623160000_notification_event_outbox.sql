create extension if not exists pgcrypto with schema extensions;

create table if not exists public.notification_events (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'expo' check (provider in ('expo')),
  token text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

create index if not exists notification_events_pending_idx
on public.notification_events (status, next_attempt_at, created_at)
where status in ('pending', 'processing', 'retry');

create index if not exists notification_events_profile_created_idx
on public.notification_events (profile_id, created_at desc);

revoke all on table public.notification_events from public;
revoke all on table public.notification_events from anon;
revoke all on table public.notification_events from authenticated;

create or replace function public.send_expo_push_to_profile(
  target_profile_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record record;
begin
  for token_record in
    select token
    from public.notification_tokens
    where user_id = target_profile_id
      and provider = 'expo'
  loop
    insert into public.notification_events (
      profile_id,
      provider,
      token,
      title,
      body,
      data,
      status,
      next_attempt_at,
      updated_at
    )
    values (
      target_profile_id,
      'expo',
      token_record.token,
      coalesce(notification_title, ''),
      coalesce(notification_body, ''),
      coalesce(notification_data, '{}'::jsonb),
      'pending',
      now(),
      now()
    );
  end loop;
end;
$$;

revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from public;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from anon;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from authenticated;

create or replace function public.claim_notification_events(p_limit integer default 50)
returns table (
  id uuid,
  token text,
  title text,
  body text,
  data jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_events as (
    select e.id
    from public.notification_events as e
    where e.provider = 'expo'
      and e.status in ('pending', 'processing', 'retry')
      and e.next_attempt_at <= now()
    order by e.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    for update skip locked
  )
  update public.notification_events as e
  set
    status = 'processing',
    attempts = e.attempts + 1,
    claimed_at = now(),
    next_attempt_at = now() + interval '5 minutes',
    updated_at = now()
  from next_events
  where e.id = next_events.id
  returning e.id, e.token, e.title, e.body, e.data;
end;
$$;

create or replace function public.mark_notification_event_delivered(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set
    status = 'delivered',
    delivered_at = now(),
    last_error = null,
    updated_at = now()
  where id = p_event_id;
end;
$$;

create or replace function public.mark_notification_event_failed(p_event_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set
    status = case when attempts >= 5 then 'failed' else 'retry' end,
    claimed_at = case when attempts >= 5 then claimed_at else null end,
    next_attempt_at = case
      when attempts >= 5 then next_attempt_at
      else now() + make_interval(secs => least(3600, greatest(60, attempts * 60)))
    end,
    last_error = left(coalesce(p_error, 'unknown push delivery error'), 1000),
    updated_at = now()
  where id = p_event_id;
end;
$$;

revoke all on function public.claim_notification_events(integer) from public;
revoke all on function public.claim_notification_events(integer) from anon;
revoke all on function public.claim_notification_events(integer) from authenticated;
grant execute on function public.claim_notification_events(integer) to service_role;

revoke all on function public.mark_notification_event_delivered(uuid) from public;
revoke all on function public.mark_notification_event_delivered(uuid) from anon;
revoke all on function public.mark_notification_event_delivered(uuid) from authenticated;
grant execute on function public.mark_notification_event_delivered(uuid) to service_role;

revoke all on function public.mark_notification_event_failed(uuid, text) from public;
revoke all on function public.mark_notification_event_failed(uuid, text) from anon;
revoke all on function public.mark_notification_event_failed(uuid, text) from authenticated;
grant execute on function public.mark_notification_event_failed(uuid, text) to service_role;

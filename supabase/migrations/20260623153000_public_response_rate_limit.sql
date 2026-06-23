create table if not exists public.public_response_rate_limits (
  scope text not null check (scope in ('token_ip', 'ip')),
  key_hash text not null check (char_length(key_hash) between 32 and 256),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

alter table public.public_response_rate_limits enable row level security;

create index if not exists public_response_rate_limits_updated_idx
on public.public_response_rate_limits (updated_at);

revoke all on table public.public_response_rate_limits from public;
revoke all on table public.public_response_rate_limits from anon;
revoke all on table public.public_response_rate_limits from authenticated;

create or replace function public.check_public_response_rate_limit(
  p_token_ip_hash text,
  p_ip_hash text,
  p_window_seconds integer default 600,
  p_token_ip_limit integer default 8,
  p_ip_limit integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  token_ip_count integer;
  ip_count integer;
  retry_after_seconds integer;
  is_allowed boolean;
begin
  if nullif(trim(p_token_ip_hash), '') is null or nullif(trim(p_ip_hash), '') is null then
    raise exception 'rate limit key is required';
  end if;

  if p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'rate limit window is out of range';
  end if;

  current_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - now())))::integer
  );

  insert into public.public_response_rate_limits (scope, key_hash, window_start, request_count, updated_at)
  values ('token_ip', p_token_ip_hash, current_window, 1, now())
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = public.public_response_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into token_ip_count;

  insert into public.public_response_rate_limits (scope, key_hash, window_start, request_count, updated_at)
  values ('ip', p_ip_hash, current_window, 1, now())
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = public.public_response_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into ip_count;

  is_allowed := token_ip_count <= p_token_ip_limit and ip_count <= p_ip_limit;

  return jsonb_build_object(
    'allowed', is_allowed,
    'retryAfterSeconds', retry_after_seconds,
    'tokenIpCount', token_ip_count,
    'ipCount', ip_count,
    'tokenIpLimit', p_token_ip_limit,
    'ipLimit', p_ip_limit
  );
end;
$$;

revoke all on function public.check_public_response_rate_limit(text, text, integer, integer, integer) from public;
revoke all on function public.check_public_response_rate_limit(text, text, integer, integer, integer) from anon;
revoke all on function public.check_public_response_rate_limit(text, text, integer, integer, integer) from authenticated;
grant execute on function public.check_public_response_rate_limit(text, text, integer, integer, integer) to service_role;

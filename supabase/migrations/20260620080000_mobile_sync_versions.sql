create table if not exists public.mobile_sync_versions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mobile_sync_versions enable row level security;

drop policy if exists "Users can read own mobile sync version" on public.mobile_sync_versions;
create policy "Users can read own mobile sync version"
on public.mobile_sync_versions for select
to authenticated
using (user_id = auth.uid());

create or replace function public.touch_mobile_sync_version(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.mobile_sync_versions (user_id, version, updated_at)
  values (target_user_id, now(), now())
  on conflict (user_id)
  do update set
    version = excluded.version,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.touch_mobile_sync_version(uuid) from public;
revoke all on function public.touch_mobile_sync_version(uuid) from anon;
revoke all on function public.touch_mobile_sync_version(uuid) from authenticated;

create or replace function public.touch_card_mobile_sync_users(target_card_id uuid, target_owner_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_to_touch uuid;
  recipient_record record;
begin
  owner_to_touch := target_owner_id;

  if owner_to_touch is null then
    select owner_id
      into owner_to_touch
      from public.appointment_cards
      where id = target_card_id;
  end if;

  perform public.touch_mobile_sync_version(owner_to_touch);

  for recipient_record in
    select recipient_profile_id
    from public.card_recipients
    where card_id = target_card_id
  loop
    perform public.touch_mobile_sync_version(recipient_record.recipient_profile_id);
  end loop;
end;
$$;

revoke all on function public.touch_card_mobile_sync_users(uuid, uuid) from public;
revoke all on function public.touch_card_mobile_sync_users(uuid, uuid) from anon;
revoke all on function public.touch_card_mobile_sync_users(uuid, uuid) from authenticated;

create or replace function public.touch_profile_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_friend_request_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.requester_id, old.requester_id));
  perform public.touch_mobile_sync_version(coalesce(new.addressee_id, old.addressee_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_friendship_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.user_a_id, old.user_a_id));
  perform public.touch_mobile_sync_version(coalesce(new.user_b_id, old.user_b_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_appointment_card_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.touch_card_mobile_sync_users(old.id, old.owner_id);
    return old;
  end if;

  perform public.touch_card_mobile_sync_users(new.id, new.owner_id);
  return new;
end;
$$;

create or replace function public.touch_appointment_candidate_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_card_mobile_sync_users(coalesce(new.card_id, old.card_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_appointment_respondent_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.profile_id, old.profile_id));
  perform public.touch_card_mobile_sync_users(coalesce(new.card_id, old.card_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_candidate_response_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  respondent_record record;
begin
  select card_id, profile_id
    into respondent_record
    from public.appointment_respondents
    where id = coalesce(new.respondent_id, old.respondent_id);

  perform public.touch_mobile_sync_version(respondent_record.profile_id);
  perform public.touch_card_mobile_sync_users(respondent_record.card_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_appointment_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.owner_id, old.owner_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_todo_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.owner_id, old.owner_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_card_recipient_mobile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_mobile_sync_version(coalesce(new.recipient_profile_id, old.recipient_profile_id));
  perform public.touch_card_mobile_sync_users(coalesce(new.card_id, old.card_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_profile_mobile_sync on public.profiles;
create trigger touch_profile_mobile_sync
after insert or update on public.profiles
for each row execute function public.touch_profile_mobile_sync();

drop trigger if exists touch_friend_request_mobile_sync on public.friend_requests;
create trigger touch_friend_request_mobile_sync
after insert or update or delete on public.friend_requests
for each row execute function public.touch_friend_request_mobile_sync();

drop trigger if exists touch_friendship_mobile_sync on public.friendships;
create trigger touch_friendship_mobile_sync
after insert or delete on public.friendships
for each row execute function public.touch_friendship_mobile_sync();

drop trigger if exists touch_appointment_card_mobile_sync_write on public.appointment_cards;
create trigger touch_appointment_card_mobile_sync_write
after insert or update on public.appointment_cards
for each row execute function public.touch_appointment_card_mobile_sync();

drop trigger if exists touch_appointment_card_mobile_sync_delete on public.appointment_cards;
create trigger touch_appointment_card_mobile_sync_delete
before delete on public.appointment_cards
for each row execute function public.touch_appointment_card_mobile_sync();

drop trigger if exists touch_appointment_candidate_mobile_sync_write on public.appointment_candidates;
create trigger touch_appointment_candidate_mobile_sync_write
after insert or update on public.appointment_candidates
for each row execute function public.touch_appointment_candidate_mobile_sync();

drop trigger if exists touch_appointment_candidate_mobile_sync_delete on public.appointment_candidates;
create trigger touch_appointment_candidate_mobile_sync_delete
before delete on public.appointment_candidates
for each row execute function public.touch_appointment_candidate_mobile_sync();

drop trigger if exists touch_appointment_respondent_mobile_sync_write on public.appointment_respondents;
create trigger touch_appointment_respondent_mobile_sync_write
after insert or update on public.appointment_respondents
for each row execute function public.touch_appointment_respondent_mobile_sync();

drop trigger if exists touch_appointment_respondent_mobile_sync_delete on public.appointment_respondents;
create trigger touch_appointment_respondent_mobile_sync_delete
before delete on public.appointment_respondents
for each row execute function public.touch_appointment_respondent_mobile_sync();

drop trigger if exists touch_candidate_response_mobile_sync_write on public.appointment_candidate_responses;
create trigger touch_candidate_response_mobile_sync_write
after insert or update on public.appointment_candidate_responses
for each row execute function public.touch_candidate_response_mobile_sync();

drop trigger if exists touch_candidate_response_mobile_sync_delete on public.appointment_candidate_responses;
create trigger touch_candidate_response_mobile_sync_delete
before delete on public.appointment_candidate_responses
for each row execute function public.touch_candidate_response_mobile_sync();

drop trigger if exists touch_appointment_mobile_sync on public.appointments;
create trigger touch_appointment_mobile_sync
after insert or update or delete on public.appointments
for each row execute function public.touch_appointment_mobile_sync();

drop trigger if exists touch_todo_mobile_sync on public.todos;
create trigger touch_todo_mobile_sync
after insert or update or delete on public.todos
for each row execute function public.touch_todo_mobile_sync();

drop trigger if exists touch_card_recipient_mobile_sync_write on public.card_recipients;
create trigger touch_card_recipient_mobile_sync_write
after insert or update on public.card_recipients
for each row execute function public.touch_card_recipient_mobile_sync();

drop trigger if exists touch_card_recipient_mobile_sync_delete on public.card_recipients;
create trigger touch_card_recipient_mobile_sync_delete
before delete on public.card_recipients
for each row execute function public.touch_card_recipient_mobile_sync();

insert into public.mobile_sync_versions (user_id, version, updated_at)
select id, now(), now()
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.get_mobile_sync_snapshot(p_since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  latest_changed_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.mobile_sync_versions (user_id, version, updated_at)
  values (current_user_id, now(), now())
  on conflict (user_id) do nothing;

  select version
    into latest_changed_at
    from public.mobile_sync_versions
    where user_id = current_user_id;

  return jsonb_build_object(
    'serverTime', now(),
    'syncVersion', coalesce(latest_changed_at, '1970-01-01T00:00:00Z'::timestamptz),
    'hasChanges', p_since is null or coalesce(latest_changed_at > p_since, false)
  );
end;
$$;

revoke all on function public.get_mobile_sync_snapshot(timestamptz) from public;
revoke all on function public.get_mobile_sync_snapshot(timestamptz) from anon;
grant execute on function public.get_mobile_sync_snapshot(timestamptz) to authenticated;

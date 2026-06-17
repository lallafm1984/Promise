create extension if not exists pg_net with schema extensions;

create or replace function public.send_expo_push_to_profile(
  target_profile_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions, net
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
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', token_record.token,
        'title', notification_title,
        'body', notification_body,
        'sound', 'default',
        'data', notification_data
      )
    );
  end loop;
end;
$$;

revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from public;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from anon;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from authenticated;

create or replace function public.notify_friend_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_name text;
begin
  if new.status <> 'PENDING' then
    return new;
  end if;

  select display_name
    into requester_name
    from public.profiles
    where id = new.requester_id;

  perform public.send_expo_push_to_profile(
    new.addressee_id,
    '새 친구 요청',
    coalesce(requester_name, '친구') || '님이 친구를 요청했어요.',
    jsonb_build_object(
      'url', '/friends',
      'type', 'friend_request',
      'id', new.id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_friend_request_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addressee_name text;
begin
  if old.status = new.status or new.status <> 'ACCEPTED' then
    return new;
  end if;

  select display_name
    into addressee_name
    from public.profiles
    where id = new.addressee_id;

  perform public.send_expo_push_to_profile(
    new.requester_id,
    '친구 추가 완료',
    coalesce(addressee_name, '친구') || '님과 친구가 되었어요.',
    jsonb_build_object(
      'url', '/friends',
      'type', 'friend_accepted',
      'id', new.id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_card_recipient_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  card_title text;
  card_location text;
  owner_name text;
begin
  select c.title, c.location, p.display_name
    into card_title, card_location, owner_name
    from public.appointment_cards c
    join public.profiles p on p.id = c.owner_id
    where c.id = new.card_id;

  perform public.send_expo_push_to_profile(
    new.recipient_profile_id,
    '새 약속 카드',
    coalesce(owner_name, '친구') || '님이 ' || coalesce(card_location, '약속') || ' 약속 카드를 보냈어요.',
    jsonb_build_object(
      'url', '/manage',
      'type', 'card_received',
      'id', new.card_id,
      'title', card_title
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_friend_request_created on public.friend_requests;
create trigger notify_friend_request_created
after insert on public.friend_requests
for each row execute function public.notify_friend_request_created();

drop trigger if exists notify_friend_request_accepted on public.friend_requests;
create trigger notify_friend_request_accepted
after update of status on public.friend_requests
for each row execute function public.notify_friend_request_accepted();

drop trigger if exists notify_card_recipient_created on public.card_recipients;
create trigger notify_card_recipient_created
after insert on public.card_recipients
for each row execute function public.notify_card_recipient_created();

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
    '친구 요청이 왔어요',
    coalesce(requester_name, '친구') || '님에게서 친구 요청이 왔어요.',
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
    '친구가 되었어요',
    coalesce(addressee_name, '친구') || '와 친구가 되었어요.',
    jsonb_build_object(
      'url', '/friends',
      'type', 'friend_accepted',
      'id', new.id
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_friend_request_created() from public;
revoke all on function public.notify_friend_request_created() from anon;
revoke all on function public.notify_friend_request_created() from authenticated;
revoke all on function public.notify_friend_request_accepted() from public;
revoke all on function public.notify_friend_request_accepted() from anon;
revoke all on function public.notify_friend_request_accepted() from authenticated;

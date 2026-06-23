create or replace function public.notify_card_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_record record;
  owner_name text;
begin
  if new.status <> 'CONFIRMED' or old.status is not distinct from new.status then
    return new;
  end if;

  select display_name
    into owner_name
    from public.profiles
    where id = new.owner_id;

  for recipient_record in
    select recipient_profile_id
    from public.card_recipients
    where card_id = new.id
  loop
    perform public.send_expo_push_to_profile(
      recipient_record.recipient_profile_id,
      '약속이 확정되었습니다',
      coalesce(nullif(trim(owner_name), ''), '친구') || '님이 약속을 확정하였습니다. 일정에 추가됩니다.',
      jsonb_build_object(
        'url', '/schedule',
        'type', 'card_confirmed',
        'id', new.id,
        'title', new.title
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_card_confirmed() from public;
revoke all on function public.notify_card_confirmed() from anon;
revoke all on function public.notify_card_confirmed() from authenticated;

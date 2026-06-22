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
    '친구가 카드를 보냈어요',
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

revoke all on function public.notify_card_recipient_created() from public;
revoke all on function public.notify_card_recipient_created() from anon;
revoke all on function public.notify_card_recipient_created() from authenticated;

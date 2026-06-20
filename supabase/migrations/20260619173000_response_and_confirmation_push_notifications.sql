create or replace function public.notify_card_response_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  card_owner_id uuid;
  card_title text;
  card_location text;
  respondent_name text;
begin
  select c.owner_id, c.title, c.location
    into card_owner_id, card_title, card_location
    from public.appointment_cards c
    where c.id = new.card_id;

  if card_owner_id is null or card_owner_id = new.profile_id then
    return new;
  end if;

  respondent_name := nullif(trim(new.display_name), '');

  perform public.send_expo_push_to_profile(
    card_owner_id,
    '응답이 도착했어요',
    coalesce(respondent_name, '상대방') || '님이 ' || coalesce(card_location, '약속') || ' 카드에 답했어요.',
    jsonb_build_object(
      'url', '/manage?tab=SENT_HAS_RESPONSE',
      'type', 'card_response_received',
      'id', new.card_id,
      'title', card_title
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_card_response_received() from public;
revoke all on function public.notify_card_response_received() from anon;
revoke all on function public.notify_card_response_received() from authenticated;

create or replace function public.notify_card_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_record record;
  owner_name text;
  selected_label text;
begin
  if new.status <> 'CONFIRMED' or old.status is not distinct from new.status then
    return new;
  end if;

  select display_name
    into owner_name
    from public.profiles
    where id = new.owner_id;

  select label
    into selected_label
    from public.appointment_candidates
    where id = new.selected_candidate_id;

  for recipient_record in
    select recipient_profile_id
    from public.card_recipients
    where card_id = new.id
  loop
    perform public.send_expo_push_to_profile(
      recipient_record.recipient_profile_id,
      '일정이 확정됐어요',
      coalesce(owner_name, '친구') || '님이 ' || coalesce(selected_label, new.location, '약속') || ' 일정을 확정했어요.',
      jsonb_build_object(
        'url', '/manage?tab=RECEIVED_CONFIRMED',
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

drop trigger if exists notify_card_response_received on public.appointment_respondents;
create trigger notify_card_response_received
after insert on public.appointment_respondents
for each row execute function public.notify_card_response_received();

drop trigger if exists notify_card_confirmed on public.appointment_cards;
create trigger notify_card_confirmed
after update of status on public.appointment_cards
for each row execute function public.notify_card_confirmed();

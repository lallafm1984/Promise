create index if not exists appointment_cards_expires_idx
on public.appointment_cards (expires_at);

create or replace function public.cleanup_expired_appointment_cards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired_cards as (
    select id
    from public.appointment_cards
    where expires_at <= now()
  ),
  deleted_appointments as (
    delete from public.appointments a
    using expired_cards e
    where a.card_id = e.id
    returning a.id
  ),
  deleted_cards as (
    delete from public.appointment_cards c
    using expired_cards e
    where c.id = e.id
    returning c.id
  )
  select count(*) into deleted_count from deleted_cards;

  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_appointment_cards() from public;
revoke all on function public.cleanup_expired_appointment_cards() from anon;
revoke all on function public.cleanup_expired_appointment_cards() from authenticated;
grant execute on function public.cleanup_expired_appointment_cards() to service_role;

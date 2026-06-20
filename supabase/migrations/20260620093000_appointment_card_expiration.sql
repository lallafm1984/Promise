alter table public.appointment_cards
add column if not exists expires_at timestamptz;

update public.appointment_cards
set expires_at = coalesce(created_at, now()) + interval '3 days'
where expires_at is null;

alter table public.appointment_cards
alter column expires_at set default (now() + interval '3 days');

alter table public.appointment_cards
alter column expires_at set not null;

create index if not exists appointment_cards_open_expires_idx
on public.appointment_cards (expires_at)
where status in ('PENDING'::public.appointment_status, 'VOTING'::public.appointment_status);

create or replace function public.cleanup_expired_appointment_cards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with deleted_cards as (
    delete from public.appointment_cards
    where expires_at <= now()
      and status in ('PENDING'::public.appointment_status, 'VOTING'::public.appointment_status)
    returning id
  )
  select count(*) into deleted_count from deleted_cards;

  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_appointment_cards() from public;
revoke all on function public.cleanup_expired_appointment_cards() from anon;
revoke all on function public.cleanup_expired_appointment_cards() from authenticated;
grant execute on function public.cleanup_expired_appointment_cards() to service_role;

do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when insufficient_privilege or undefined_file then
      null;
  end;

  if to_regnamespace('cron') is not null then
    begin
      execute $cron$select cron.unschedule('whenbollae-expire-appointment-cards')$cron$;
    exception
      when others then
        null;
    end;

    begin
      execute $cron$select cron.schedule(
        'whenbollae-expire-appointment-cards',
        '*/30 * * * *',
        'select public.cleanup_expired_appointment_cards();'
      )$cron$;
    exception
      when others then
        null;
    end;
  end if;
end $$;

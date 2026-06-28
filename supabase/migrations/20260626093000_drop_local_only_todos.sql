-- Directly created schedule items and todos are now device-local.
-- Keep card-linked appointments, but remove legacy manual schedule rows.
delete from public.appointments
where card_id is null;

drop table if exists public.todos cascade;

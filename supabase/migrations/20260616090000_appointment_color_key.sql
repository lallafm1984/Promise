alter table public.appointments
add column if not exists color_key text not null default 'sky';

do $$
begin
  alter table public.appointments
  add constraint appointments_color_key_check
  check (color_key in ('coral', 'mint', 'lime', 'sky', 'amber'));
exception
  when duplicate_object then null;
end $$;

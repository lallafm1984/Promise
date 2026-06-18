do $$
begin
  alter publication supabase_realtime add table public.appointment_cards;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.appointment_respondents;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.appointment_candidate_responses;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

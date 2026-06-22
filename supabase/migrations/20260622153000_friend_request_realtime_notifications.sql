do $$
begin
  alter publication supabase_realtime add table public.friend_requests;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

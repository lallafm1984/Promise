do $$
begin
  alter publication supabase_realtime add table public.mobile_sync_versions;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

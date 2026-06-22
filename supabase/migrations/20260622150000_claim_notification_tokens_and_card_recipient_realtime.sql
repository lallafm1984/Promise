create or replace function public.register_notification_token(
  notification_provider text,
  notification_token text,
  notification_device_label text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Login is required to register a notification token.';
  end if;

  if notification_provider not in ('expo', 'fcm') then
    raise exception 'Unsupported notification provider.';
  end if;

  if length(trim(notification_token)) = 0 then
    raise exception 'Notification token is required.';
  end if;

  delete from public.notification_tokens
  where provider = notification_provider
    and token = notification_token;

  insert into public.notification_tokens (user_id, provider, token, device_label)
  values (
    current_profile_id,
    notification_provider,
    notification_token,
    coalesce(notification_device_label, '')
  );
end;
$$;

revoke all on function public.register_notification_token(text, text, text) from public;
revoke all on function public.register_notification_token(text, text, text) from anon;
revoke all on function public.register_notification_token(text, text, text) from authenticated;
grant execute on function public.register_notification_token(text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.card_recipients;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

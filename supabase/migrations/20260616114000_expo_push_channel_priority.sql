create or replace function public.send_expo_push_to_profile(
  target_profile_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  token_record record;
begin
  for token_record in
    select token
    from public.notification_tokens
    where user_id = target_profile_id
      and provider = 'expo'
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', token_record.token,
        'title', notification_title,
        'body', notification_body,
        'sound', 'default',
        'channelId', 'whenbollae-default',
        'priority', 'high',
        'data', notification_data
      )
    );
  end loop;
end;
$$;

revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from public;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from anon;
revoke all on function public.send_expo_push_to_profile(uuid, text, text, jsonb) from authenticated;

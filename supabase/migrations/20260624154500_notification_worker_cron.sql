do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when insufficient_privilege or undefined_file then
      null;
  end;

  begin
    create extension if not exists pg_net with schema extensions;
  exception
    when insufficient_privilege or undefined_file then
      null;
  end;

  if to_regnamespace('cron') is not null
    and to_regnamespace('net') is not null
    and to_regclass('vault.decrypted_secrets') is not null
    and exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'publishable_key')
  then
    begin
      execute $cron$select cron.unschedule('whenbollae-notification-worker')$cron$;
    exception
      when others then
        null;
    end;

    begin
      execute $cron$select cron.schedule(
        'whenbollae-notification-worker',
        '* * * * *',
        $job$
        select net.http_post(
          url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'project_url'), '/')
            || '/functions/v1/notification-worker',
          headers := jsonb_build_object(
            'Content-type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
          ),
          body := jsonb_build_object('scheduled_at', now())
        ) as request_id;
        $job$
      )$cron$;
    exception
      when others then
        null;
    end;
  end if;
end $$;

create or replace function public.generate_short_profile_handle()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate text;
begin
  loop
    candidate := lower(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (
      select 1
      from public.profiles as profile
      where profile.handle = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    public.generate_short_profile_handle(),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '언제볼래 친구'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
declare
  legacy_profile record;
  candidate text;
  attempts integer;
begin
  for legacy_profile in
    select p.id, p.handle
    from public.profiles as p
    join auth.users as u on u.id = p.id
    where p.handle = left(
      coalesce(
        nullif(
          regexp_replace(
            lower(
              coalesce(
                nullif(u.raw_user_meta_data ->> 'preferred_username', ''),
                nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                'user'
              )
            ),
            '[^a-z0-9._-]',
            '',
            'g'
          ),
          ''
        ),
        'user'
      ),
      20
    ) || '_' || substr(u.id::text, 1, 8)
  loop
    attempts := 0;

    loop
      candidate := lower(substr(replace(legacy_profile.id::text, '-', ''), attempts * 6 + 1, 6));

      if char_length(candidate) < 6 then
        candidate := public.generate_short_profile_handle();
      end if;

      exit when not exists (
        select 1
        from public.profiles as profile
        where profile.handle = candidate
          and profile.id <> legacy_profile.id
      );

      attempts := attempts + 1;

      if attempts >= 5 then
        candidate := public.generate_short_profile_handle();
        exit;
      end if;
    end loop;

    update public.profiles
    set handle = candidate
    where id = legacy_profile.id;
  end loop;
end $$;

revoke all on function public.generate_short_profile_handle() from public;
revoke all on function public.generate_short_profile_handle() from anon;
revoke all on function public.generate_short_profile_handle() from authenticated;

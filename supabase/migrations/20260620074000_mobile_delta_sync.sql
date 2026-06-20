alter table public.appointments
add column if not exists deleted_at timestamptz;

alter table public.todos
add column if not exists deleted_at timestamptz;

create index if not exists appointments_owner_updated_idx
on public.appointments (owner_id, updated_at desc);

create index if not exists appointments_owner_deleted_idx
on public.appointments (owner_id, deleted_at)
where deleted_at is not null;

create index if not exists todos_owner_updated_idx
on public.todos (owner_id, updated_at desc);

create index if not exists todos_owner_deleted_idx
on public.todos (owner_id, deleted_at)
where deleted_at is not null;

create or replace function public.get_mobile_sync_snapshot(p_since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  latest_changed_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  with sync_points(modified_at) as (
    select p.updated_at
    from public.profiles p
    where p.id = current_user_id

    union all
    select fr.updated_at
    from public.friend_requests fr
    where fr.requester_id = current_user_id
      or fr.addressee_id = current_user_id

    union all
    select f.created_at
    from public.friendships f
    where f.user_a_id = current_user_id
      or f.user_b_id = current_user_id

    union all
    select c.updated_at
    from public.appointment_cards c
    where c.owner_id = current_user_id
      or exists (
        select 1
        from public.card_recipients cr
        where cr.card_id = c.id
          and cr.recipient_profile_id = current_user_id
      )

    union all
    select ac.created_at
    from public.appointment_candidates ac
    where exists (
      select 1
      from public.appointment_cards c
      where c.id = ac.card_id
        and (
          c.owner_id = current_user_id
          or exists (
            select 1
            from public.card_recipients cr
            where cr.card_id = c.id
              and cr.recipient_profile_id = current_user_id
          )
        )
    )

    union all
    select ar.updated_at
    from public.appointment_respondents ar
    where ar.profile_id = current_user_id
      or exists (
        select 1
        from public.appointment_cards c
        where c.id = ar.card_id
          and c.owner_id = current_user_id
      )

    union all
    select acr.updated_at
    from public.appointment_candidate_responses acr
    join public.appointment_respondents ar on ar.id = acr.respondent_id
    where ar.profile_id = current_user_id
      or exists (
        select 1
        from public.appointment_cards c
        where c.id = ar.card_id
          and c.owner_id = current_user_id
      )

    union all
    select greatest(a.updated_at, coalesce(a.deleted_at, a.updated_at))
    from public.appointments a
    where a.owner_id = current_user_id

    union all
    select greatest(t.updated_at, coalesce(t.deleted_at, t.updated_at))
    from public.todos t
    where t.owner_id = current_user_id

    union all
    select cr.updated_at
    from public.card_recipients cr
    where cr.recipient_profile_id = current_user_id
      or exists (
        select 1
        from public.appointment_cards c
        where c.id = cr.card_id
          and c.owner_id = current_user_id
      )
  )
  select max(modified_at)
    into latest_changed_at
    from sync_points;

  return jsonb_build_object(
    'serverTime', now(),
    'syncVersion', coalesce(latest_changed_at, '1970-01-01T00:00:00Z'::timestamptz),
    'hasChanges', p_since is null or coalesce(latest_changed_at > p_since, false)
  );
end;
$$;

revoke all on function public.get_mobile_sync_snapshot(timestamptz) from public;
revoke all on function public.get_mobile_sync_snapshot(timestamptz) from anon;
grant execute on function public.get_mobile_sync_snapshot(timestamptz) to authenticated;

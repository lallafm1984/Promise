create or replace function public.are_friends(left_profile_id uuid, right_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select left_profile_id <> right_profile_id
    and exists (
      select 1
      from public.friendships f
      where (f.user_a_id = left_profile_id and f.user_b_id = right_profile_id)
        or (f.user_a_id = right_profile_id and f.user_b_id = left_profile_id)
    );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

drop policy if exists "Card owners can add recipients" on public.card_recipients;
create policy "Card owners can add recipients"
on public.card_recipients for insert
to authenticated
with check (
  public.is_appointment_card_owner(card_id)
  and public.are_friends(auth.uid(), recipient_profile_id)
);

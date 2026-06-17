create or replace function public.handle_friend_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user_id uuid;
  second_user_id uuid;
begin
  if old.status <> new.status and new.status in ('ACCEPTED', 'DECLINED', 'CANCELLED') then
    new.responded_at := coalesce(new.responded_at, now());
  end if;

  if old.status <> 'ACCEPTED' and new.status = 'ACCEPTED' then
    first_user_id := least(new.requester_id, new.addressee_id);
    second_user_id := greatest(new.requester_id, new.addressee_id);

    insert into public.friendships (user_a_id, user_b_id)
    values (first_user_id, second_user_id)
    on conflict (user_a_id, user_b_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_friend_request_status_change on public.friend_requests;
create trigger on_friend_request_status_change
before update of status on public.friend_requests
for each row execute function public.handle_friend_request_status_change();

drop policy if exists "Users can update related friend requests" on public.friend_requests;
create policy "Users can update related friend requests"
on public.friend_requests for update
to authenticated
using (
  status = 'PENDING'
  and (requester_id = auth.uid() or addressee_id = auth.uid())
)
with check (
  (requester_id = auth.uid() and status = 'CANCELLED')
  or
  (addressee_id = auth.uid() and status in ('ACCEPTED', 'DECLINED'))
);

-- Allow INSERT ... RETURNING for card owners.
-- The previous select policy only called can_access_appointment_card(id), which
-- queries appointment_cards again and cannot see the just-inserted row during
-- INSERT RETURNING evaluation.
drop policy if exists "Users can read own or received cards" on public.appointment_cards;
create policy "Users can read own or received cards"
on public.appointment_cards for select
to authenticated
using (
  owner_id = auth.uid()
  or public.can_access_appointment_card(id)
);

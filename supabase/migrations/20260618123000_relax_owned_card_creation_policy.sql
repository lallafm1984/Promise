-- Keep mobile creator writes aligned with the public-response card flow.
-- Only an authenticated user can create/update/delete their own card rows.
drop policy if exists "Users can create own cards" on public.appointment_cards;
create policy "Users can create own cards"
on public.appointment_cards for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Users can update own cards" on public.appointment_cards;
create policy "Users can update own cards"
on public.appointment_cards for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own cards" on public.appointment_cards;
create policy "Users can delete own cards"
on public.appointment_cards for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Users can create candidates for own cards" on public.appointment_candidates;
create policy "Users can create candidates for own cards"
on public.appointment_candidates for insert
to authenticated
with check (public.is_appointment_card_owner(card_id));

drop policy if exists "Users can update candidates for own cards" on public.appointment_candidates;
create policy "Users can update candidates for own cards"
on public.appointment_candidates for update
to authenticated
using (public.is_appointment_card_owner(card_id))
with check (public.is_appointment_card_owner(card_id));

drop policy if exists "Users can delete candidates for own cards" on public.appointment_candidates;
create policy "Users can delete candidates for own cards"
on public.appointment_candidates for delete
to authenticated
using (public.is_appointment_card_owner(card_id));

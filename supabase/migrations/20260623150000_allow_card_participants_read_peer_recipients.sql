drop policy if exists "Owners and recipients can read card recipients" on public.card_recipients;
drop policy if exists "Users can read recipients on accessible cards" on public.card_recipients;

create policy "Users can read recipients on accessible cards"
on public.card_recipients for select
to authenticated
using (public.can_access_appointment_card(card_id));

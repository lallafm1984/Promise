-- Allow card owners to reset old respondent rows when a confirmed card is
-- edited and shared again for a fresh accept/decline response.
drop policy if exists "Card owners can delete respondents on own cards" on public.appointment_respondents;
create policy "Card owners can delete respondents on own cards"
on public.appointment_respondents for delete
to authenticated
using (public.is_appointment_card_owner(card_id));

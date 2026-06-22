drop policy if exists "Card owners can delete candidate responses on own cards" on public.appointment_candidate_responses;
create policy "Card owners can delete candidate responses on own cards"
on public.appointment_candidate_responses for delete
to authenticated
using (
  exists (
    select 1
    from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and public.is_appointment_card_owner(r.card_id)
  )
);

drop policy if exists "Card owners can delete respondents on own cards" on public.appointment_respondents;
create policy "Card owners can delete respondents on own cards"
on public.appointment_respondents for delete
to authenticated
using (public.is_appointment_card_owner(card_id));

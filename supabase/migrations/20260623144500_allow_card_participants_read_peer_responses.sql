drop policy if exists "Users can read respondents on accessible cards" on public.appointment_respondents;
create policy "Users can read respondents on accessible cards"
on public.appointment_respondents for select
to authenticated
using (public.can_access_appointment_card(card_id));

drop policy if exists "Users can read candidate responses on accessible cards" on public.appointment_candidate_responses;
create policy "Users can read candidate responses on accessible cards"
on public.appointment_candidate_responses for select
to authenticated
using (
  exists (
    select 1
    from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and public.can_access_appointment_card(r.card_id)
  )
);

create index if not exists appointment_respondents_card_response_token_hash_idx
on public.appointment_respondents (card_id, response_token_hash)
where response_token_hash is not null;

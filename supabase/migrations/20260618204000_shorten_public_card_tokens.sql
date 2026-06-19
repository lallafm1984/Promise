alter table public.appointment_cards
alter column public_token set default translate(
  rtrim(encode(extensions.gen_random_bytes(6), 'base64'), '='),
  '+/',
  '-_'
);

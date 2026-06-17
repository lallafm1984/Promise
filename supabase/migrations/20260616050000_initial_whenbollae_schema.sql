create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.appointment_mode as enum ('DIRECT', 'POLL');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.appointment_status as enum ('DRAFT', 'PENDING', 'VOTING', 'CONFIRMED', 'DECLINED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.response_choice as enum ('YES', 'MAYBE', 'NO', 'UNANSWERED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.friend_request_status as enum ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9._-]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  base_handle text;
  safe_handle text;
begin
  base_handle := lower(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    )
  );
  safe_handle := regexp_replace(base_handle, '[^a-z0-9._-]', '', 'g');
  safe_handle := left(coalesce(nullif(safe_handle, ''), 'user'), 20) || '_' || substr(new.id::text, 1, 8);

  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    safe_handle,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '새 친구'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table if not exists public.friend_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_request_status not null default 'PENDING',
  message text not null default '' check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index if not exists friend_requests_pending_unique
on public.friend_requests (requester_id, addressee_id)
where status = 'PENDING';

create unique index if not exists friend_requests_pending_pair_unique
on public.friend_requests (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
)
where status = 'PENDING';

create index if not exists friend_requests_requester_idx
on public.friend_requests (requester_id, status, created_at desc);

create index if not exists friend_requests_addressee_idx
on public.friend_requests (addressee_id, status, created_at desc);

drop trigger if exists set_friend_requests_updated_at on public.friend_requests;
create trigger set_friend_requests_updated_at
before update on public.friend_requests
for each row execute function public.set_updated_at();

create table if not exists public.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a_id < user_b_id)
);

create unique index if not exists friendships_pair_unique
on public.friendships (user_a_id, user_b_id);

create index if not exists friendships_user_a_idx
on public.friendships (user_a_id, created_at desc);

create index if not exists friendships_user_b_idx
on public.friendships (user_b_id, created_at desc);

create table if not exists public.appointment_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mode public.appointment_mode not null,
  status public.appointment_status not null default 'DRAFT',
  title text not null check (char_length(title) between 1 and 140),
  location text not null check (char_length(location) between 1 and 200),
  message text not null default '' check (char_length(message) <= 500),
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  selected_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_cards_owner_status_idx
on public.appointment_cards (owner_id, status, created_at desc);

create index if not exists appointment_cards_public_token_idx
on public.appointment_cards (public_token);

drop trigger if exists set_appointment_cards_updated_at on public.appointment_cards;
create trigger set_appointment_cards_updated_at
before update on public.appointment_cards
for each row execute function public.set_updated_at();

create table if not exists public.appointment_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  card_id uuid not null references public.appointment_cards(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default '' check (char_length(label) <= 80),
  short_label text not null default '' check (char_length(short_label) <= 40),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists appointment_candidates_card_sort_unique
on public.appointment_candidates (card_id, sort_order);

create index if not exists appointment_candidates_card_starts_idx
on public.appointment_candidates (card_id, starts_at);

do $$
begin
  alter table public.appointment_cards
  add constraint appointment_cards_selected_candidate_fk
  foreign key (selected_candidate_id)
  references public.appointment_candidates(id)
  on delete set null
  deferrable initially deferred;
exception
  when duplicate_object then null;
end $$;

create or replace function public.ensure_selected_candidate_belongs_to_card()
returns trigger
language plpgsql
as $$
begin
  if new.selected_candidate_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.appointment_candidates c
    where c.id = new.selected_candidate_id
      and c.card_id = new.id
  ) then
    raise exception 'selected candidate must belong to the appointment card';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_selected_candidate_belongs_to_card on public.appointment_cards;
create trigger ensure_selected_candidate_belongs_to_card
before insert or update of selected_candidate_id on public.appointment_cards
for each row execute function public.ensure_selected_candidate_belongs_to_card();

create table if not exists public.appointment_respondents (
  id uuid primary key default extensions.gen_random_uuid(),
  card_id uuid not null references public.appointment_cards(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  response_token_hash text,
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists appointment_respondents_card_profile_unique
on public.appointment_respondents (card_id, profile_id)
where profile_id is not null;

create index if not exists appointment_respondents_card_idx
on public.appointment_respondents (card_id, created_at desc);

drop trigger if exists set_appointment_respondents_updated_at on public.appointment_respondents;
create trigger set_appointment_respondents_updated_at
before update on public.appointment_respondents
for each row execute function public.set_updated_at();

create table if not exists public.appointment_candidate_responses (
  respondent_id uuid not null references public.appointment_respondents(id) on delete cascade,
  candidate_id uuid not null references public.appointment_candidates(id) on delete cascade,
  choice public.response_choice not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (respondent_id, candidate_id)
);

create index if not exists appointment_candidate_responses_candidate_idx
on public.appointment_candidate_responses (candidate_id, choice);

create or replace function public.ensure_candidate_response_same_card()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.appointment_respondents r
    join public.appointment_candidates c on c.id = new.candidate_id
    where r.id = new.respondent_id
      and r.card_id = c.card_id
  ) then
    raise exception 'candidate response must target a candidate on the respondent card';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_candidate_response_same_card on public.appointment_candidate_responses;
create trigger ensure_candidate_response_same_card
before insert or update on public.appointment_candidate_responses
for each row execute function public.ensure_candidate_response_same_card();

drop trigger if exists set_appointment_candidate_responses_updated_at on public.appointment_candidate_responses;
create trigger set_appointment_candidate_responses_updated_at
before update on public.appointment_candidate_responses
for each row execute function public.set_updated_at();

create table if not exists public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.appointment_cards(id) on delete set null,
  candidate_id uuid references public.appointment_candidates(id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  location text not null default '' check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  color_key text not null default 'sky',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_owner_starts_idx
on public.appointments (owner_id, starts_at);

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create table if not exists public.todos (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  date_key date not null,
  title text not null check (char_length(title) between 1 and 140),
  detail text not null default '' check (char_length(detail) <= 300),
  done boolean not null default false,
  color_key text not null default 'coral' check (color_key in ('coral', 'mint', 'lime', 'sky', 'amber')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todos_owner_date_idx
on public.todos (owner_id, date_key, done);

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

create table if not exists public.card_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  card_id uuid not null references public.appointment_cards(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  delivery_status text not null default 'SENT' check (delivery_status in ('SENT', 'OPENED', 'RESPONDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists card_recipients_card_profile_unique
on public.card_recipients (card_id, recipient_profile_id);

create index if not exists card_recipients_recipient_idx
on public.card_recipients (recipient_profile_id, created_at desc);

drop trigger if exists set_card_recipients_updated_at on public.card_recipients;
create trigger set_card_recipients_updated_at
before update on public.card_recipients
for each row execute function public.set_updated_at();

create table if not exists public.notification_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'expo' check (provider in ('expo', 'fcm')),
  token text not null,
  device_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, token)
);

create index if not exists notification_tokens_user_idx
on public.notification_tokens (user_id, created_at desc);

drop trigger if exists set_notification_tokens_updated_at on public.notification_tokens;
create trigger set_notification_tokens_updated_at
before update on public.notification_tokens
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.appointment_cards enable row level security;
alter table public.appointment_candidates enable row level security;
alter table public.appointment_respondents enable row level security;
alter table public.appointment_candidate_responses enable row level security;
alter table public.appointments enable row level security;
alter table public.todos enable row level security;
alter table public.card_recipients enable row level security;
alter table public.notification_tokens enable row level security;

create or replace function public.is_appointment_card_owner(check_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointment_cards c
    where c.id = check_card_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_appointment_card(check_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointment_cards c
    where c.id = check_card_id
      and c.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.card_recipients cr
    where cr.card_id = check_card_id
      and cr.recipient_profile_id = auth.uid()
  );
$$;

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

grant execute on function public.is_appointment_card_owner(uuid) to authenticated;
grant execute on function public.can_access_appointment_card(uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

drop policy if exists "Authenticated users can read public profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read related friend requests" on public.friend_requests;
drop policy if exists "Users can send friend requests" on public.friend_requests;
drop policy if exists "Users can update related friend requests" on public.friend_requests;
drop policy if exists "Users can read own friendships" on public.friendships;
drop policy if exists "Users can delete own friendships" on public.friendships;
drop policy if exists "Users can read own or received cards" on public.appointment_cards;
drop policy if exists "Users can create own cards" on public.appointment_cards;
drop policy if exists "Users can update own cards" on public.appointment_cards;
drop policy if exists "Users can delete own cards" on public.appointment_cards;
drop policy if exists "Users can read candidates on accessible cards" on public.appointment_candidates;
drop policy if exists "Users can create candidates for own cards" on public.appointment_candidates;
drop policy if exists "Users can update candidates for own cards" on public.appointment_candidates;
drop policy if exists "Users can delete candidates for own cards" on public.appointment_candidates;
drop policy if exists "Users can read respondents on own or self cards" on public.appointment_respondents;
drop policy if exists "Authenticated recipients can create own respondent row" on public.appointment_respondents;
drop policy if exists "Authenticated respondents can update own respondent row" on public.appointment_respondents;
drop policy if exists "Users can read candidate responses on own or self rows" on public.appointment_candidate_responses;
drop policy if exists "Authenticated respondents can create own candidate responses" on public.appointment_candidate_responses;
drop policy if exists "Authenticated respondents can update own candidate responses" on public.appointment_candidate_responses;
drop policy if exists "Users can manage own appointments" on public.appointments;
drop policy if exists "Users can manage own todos" on public.todos;
drop policy if exists "Owners and recipients can read card recipients" on public.card_recipients;
drop policy if exists "Card owners can add recipients" on public.card_recipients;
drop policy if exists "Recipients can update own delivery status" on public.card_recipients;
drop policy if exists "Card owners can delete recipients" on public.card_recipients;
drop policy if exists "Users can manage own notification tokens" on public.notification_tokens;

create policy "Authenticated users can read public profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read related friend requests"
on public.friend_requests for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Users can send friend requests"
on public.friend_requests for insert
to authenticated
with check (requester_id = auth.uid() and status = 'PENDING');

create policy "Users can update related friend requests"
on public.friend_requests for update
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (
  (requester_id = auth.uid() and status = 'CANCELLED')
  or
  (addressee_id = auth.uid() and status in ('ACCEPTED', 'DECLINED'))
);

create policy "Users can read own friendships"
on public.friendships for select
to authenticated
using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy "Users can delete own friendships"
on public.friendships for delete
to authenticated
using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy "Users can read own or received cards"
on public.appointment_cards for select
to authenticated
using (public.can_access_appointment_card(id));

create policy "Users can create own cards"
on public.appointment_cards for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update own cards"
on public.appointment_cards for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete own cards"
on public.appointment_cards for delete
to authenticated
using (owner_id = auth.uid());

create policy "Users can read candidates on accessible cards"
on public.appointment_candidates for select
to authenticated
using (public.can_access_appointment_card(card_id));

create policy "Users can create candidates for own cards"
on public.appointment_candidates for insert
to authenticated
with check (public.is_appointment_card_owner(card_id));

create policy "Users can update candidates for own cards"
on public.appointment_candidates for update
to authenticated
using (public.is_appointment_card_owner(card_id))
with check (public.is_appointment_card_owner(card_id));

create policy "Users can delete candidates for own cards"
on public.appointment_candidates for delete
to authenticated
using (public.is_appointment_card_owner(card_id));

create policy "Users can read respondents on own or self cards"
on public.appointment_respondents for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_appointment_card_owner(card_id)
);

create policy "Authenticated recipients can create own respondent row"
on public.appointment_respondents for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_access_appointment_card(card_id)
);

create policy "Authenticated respondents can update own respondent row"
on public.appointment_respondents for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Users can read candidate responses on own or self rows"
on public.appointment_candidate_responses for select
to authenticated
using (
  exists (
    select 1
    from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and (r.profile_id = auth.uid() or public.is_appointment_card_owner(r.card_id))
  )
);

create policy "Authenticated respondents can create own candidate responses"
on public.appointment_candidate_responses for insert
to authenticated
with check (
  exists (
    select 1 from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and r.profile_id = auth.uid()
  )
);

create policy "Authenticated respondents can update own candidate responses"
on public.appointment_candidate_responses for update
to authenticated
using (
  exists (
    select 1 from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and r.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.appointment_respondents r
    where r.id = appointment_candidate_responses.respondent_id
      and r.profile_id = auth.uid()
  )
);

create policy "Users can manage own appointments"
on public.appointments for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can manage own todos"
on public.todos for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Owners and recipients can read card recipients"
on public.card_recipients for select
to authenticated
using (recipient_profile_id = auth.uid() or public.is_appointment_card_owner(card_id));

create policy "Card owners can add recipients"
on public.card_recipients for insert
to authenticated
with check (
  public.is_appointment_card_owner(card_id)
  and public.are_friends(auth.uid(), recipient_profile_id)
);

create policy "Recipients can update own delivery status"
on public.card_recipients for update
to authenticated
using (recipient_profile_id = auth.uid())
with check (recipient_profile_id = auth.uid());

create policy "Card owners can delete recipients"
on public.card_recipients for delete
to authenticated
using (public.is_appointment_card_owner(card_id));

create policy "Users can manage own notification tokens"
on public.notification_tokens for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

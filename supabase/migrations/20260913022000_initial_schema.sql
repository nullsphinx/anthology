create extension if not exists citext with schema extensions;

create type public.media_type as enum ('movie', 'show', 'book', 'album');
create type public.library_status as enum ('want', 'in-progress', 'paused', 'completed', 'dropped');
create type public.progress_source as enum ('manual', 'episodes');
create type public.visibility as enum ('private', 'friends', 'public');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.group_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext unique,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username::text ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  constraint profiles_bio_length check (char_length(bio) <= 500)
);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  type public.media_type not null,
  title text not null,
  year integer,
  release_info text not null default '',
  genres text[] not null default '{}',
  summary text not null default '',
  creator text not null default '',
  runtime_minutes integer,
  seasons jsonb,
  poster_url text,
  backdrop_url text,
  community_rating numeric(4,2),
  current_provider text not null,
  provider_url text not null default '',
  catalog_rank integer,
  metadata_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_items_title_length check (char_length(title) between 1 and 500),
  constraint media_items_year_range check (year is null or year between 1800 and 2200),
  constraint media_items_runtime_range check (runtime_minutes is null or runtime_minutes between 0 and 100000),
  constraint media_items_rating_range check (community_rating is null or community_rating between 0 and 10),
  constraint media_items_provider check (current_provider in ('TMDB', 'Cinemeta', 'Open Library', 'MusicBrainz'))
);

create table public.external_identifiers (
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  provider text not null,
  entity_type public.media_type not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  primary key (provider, entity_type, external_id),
  constraint external_identifiers_provider check (provider in ('TMDB', 'Cinemeta', 'Open Library', 'MusicBrainz')),
  constraint external_identifiers_id_length check (char_length(external_id) between 1 and 500)
);
create index external_identifiers_media_item_idx on public.external_identifiers(media_item_id);

create table public.library_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  status public.library_status not null default 'want',
  progress smallint not null default 0,
  progress_source public.progress_source not null default 'manual',
  watched_episodes integer[] not null default '{}',
  rating smallint,
  completion_count integer not null default 0,
  visibility public.visibility not null default 'private',
  notes text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_item_id),
  constraint library_entries_progress_range check (progress between 0 and 100),
  constraint library_entries_rating_range check (rating is null or rating between 0 and 100),
  constraint library_entries_completion_count check (completion_count >= 0),
  constraint library_entries_notes_length check (char_length(notes) <= 10000)
);
create index library_entries_user_updated_idx on public.library_entries(user_id, updated_at desc);
create index library_entries_media_idx on public.library_entries(media_item_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  constraint activity_events_action check (action in ('saved', 'started', 'progressed', 'paused', 'completed', 'dropped', 'rewatched', 'rated')),
  constraint activity_events_detail_length check (char_length(detail) <= 500)
);
create index activity_events_user_created_idx on public.activity_events(user_id, created_at desc);

create table public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_distinct_users check (requester_id <> addressee_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(name) between 1 and 100),
  constraint groups_description_length check (char_length(description) <= 1000)
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.invites (
  email extensions.citext primary key,
  invited_by uuid references auth.users(id) on delete set null,
  claimed_by uuid unique references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint invites_email_shape check (position('@' in email::text) > 1)
);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger media_items_set_updated_at before update on public.media_items for each row execute function public.set_updated_at();
create trigger library_entries_set_updated_at before update on public.library_entries for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships for each row execute function public.set_updated_at();
create trigger groups_set_updated_at before update on public.groups for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.are_friends(first_user uuid, second_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = first_user and addressee_id = second_user)
        or (requester_id = second_user and addressee_id = first_user))
  );
$$;

create function public.is_group_member(target_group uuid, target_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.group_memberships where group_id = target_group and user_id = target_user);
$$;

alter table public.profiles enable row level security;
alter table public.media_items enable row level security;
alter table public.external_identifiers enable row level security;
alter table public.library_entries enable row level security;
alter table public.activity_events enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.invites enable row level security;

create policy "catalog is readable" on public.media_items for select using (true);
create policy "identifiers are readable" on public.external_identifiers for select using (true);

create policy "profiles are visible by preference" on public.profiles for select using (
  auth.uid() = user_id or visibility = 'public' or (visibility = 'friends' and public.are_friends(auth.uid(), user_id))
);
create policy "users insert their profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "users update their profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "library entries are visible by preference" on public.library_entries for select using (
  auth.uid() = user_id or visibility = 'public' or (visibility = 'friends' and public.are_friends(auth.uid(), user_id))
);
create policy "users insert their library entries" on public.library_entries for insert with check (auth.uid() = user_id);
create policy "users update their library entries" on public.library_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete their library entries" on public.library_entries for delete using (auth.uid() = user_id);

create policy "users see their activity" on public.activity_events for select using (auth.uid() = user_id);
create policy "users insert their activity" on public.activity_events for insert with check (auth.uid() = user_id);
create policy "users delete their activity" on public.activity_events for delete using (auth.uid() = user_id);

create policy "participants see friendships" on public.friendships for select using (auth.uid() in (requester_id, addressee_id));
create policy "users request friendships" on public.friendships for insert with check (auth.uid() = requester_id and status = 'pending');
create policy "participants update friendships" on public.friendships for update using (auth.uid() in (requester_id, addressee_id));
create policy "participants delete friendships" on public.friendships for delete using (auth.uid() in (requester_id, addressee_id));

create policy "members see groups" on public.groups for select using (owner_id = auth.uid() or public.is_group_member(id, auth.uid()));
create policy "users create groups" on public.groups for insert with check (owner_id = auth.uid());
create policy "owners update groups" on public.groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete groups" on public.groups for delete using (owner_id = auth.uid());
create policy "members see memberships" on public.group_memberships for select using (public.is_group_member(group_id, auth.uid()));
create policy "owners manage memberships" on public.group_memberships for all using (
  exists (select 1 from public.groups where id = group_id and owner_id = auth.uid())
) with check (
  exists (select 1 from public.groups where id = group_id and owner_id = auth.uid())
);

revoke all on public.invites from anon, authenticated;
revoke insert, update, delete on public.media_items from anon, authenticated;
revoke insert, update, delete on public.external_identifiers from anon, authenticated;
grant select on public.media_items, public.external_identifiers to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.library_entries, public.activity_events, public.friendships, public.groups, public.group_memberships to authenticated;

create function public.save_library_item(p_item jsonb, p_entry jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
  item_type public.media_type;
  item_provider text;
  item_external_id text;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;

  item_type := (p_item ->> 'type')::public.media_type;
  item_provider := p_item ->> 'provider';
  item_external_id := p_item ->> 'externalId';
  if item_provider not in ('TMDB', 'Cinemeta', 'Open Library', 'MusicBrainz')
    or char_length(coalesce(item_external_id, '')) not between 1 and 500
    or char_length(coalesce(p_item ->> 'title', '')) not between 1 and 500 then
    raise exception 'invalid media item' using errcode = '22023';
  end if;

  select media_item_id into target_id from public.external_identifiers
  where provider = item_provider and entity_type = item_type and external_id = item_external_id;

  if target_id is null then
    insert into public.media_items (
      type, title, year, release_info, genres, summary, creator, runtime_minutes, seasons,
      poster_url, backdrop_url, community_rating, current_provider, provider_url, catalog_rank
    ) values (
      item_type,
      left(p_item ->> 'title', 500),
      nullif(p_item ->> 'year', '')::integer,
      left(coalesce(p_item ->> 'releaseInfo', ''), 500),
      coalesce(array(select jsonb_array_elements_text(p_item -> 'genres')), '{}'),
      left(coalesce(p_item ->> 'summary', ''), 20000),
      left(coalesce(p_item ->> 'creator', ''), 1000),
      nullif(p_item ->> 'runtimeMinutes', '')::integer,
      p_item -> 'seasons',
      left(p_item ->> 'posterUrl', 2000),
      left(p_item ->> 'backdropUrl', 2000),
      nullif(p_item ->> 'communityRating', '')::numeric,
      item_provider,
      left(coalesce(p_item ->> 'providerUrl', ''), 2000),
      nullif(p_item ->> 'catalogRank', '')::integer
    ) returning id into target_id;
    insert into public.external_identifiers (media_item_id, provider, entity_type, external_id)
    values (target_id, item_provider, item_type, item_external_id);
  end if;

  insert into public.library_entries (
    user_id, media_item_id, status, progress, progress_source, watched_episodes, rating,
    completion_count, visibility, notes, started_at, completed_at
  ) values (
    actor, target_id,
    coalesce((p_entry ->> 'status')::public.library_status, 'want'),
    least(100, greatest(0, coalesce((p_entry ->> 'progress')::integer, 0))),
    coalesce((p_entry ->> 'progressSource')::public.progress_source, 'manual'),
    coalesce(array(select jsonb_array_elements_text(p_entry -> 'watchedEpisodes'))::integer[], '{}'),
    nullif(p_entry ->> 'rating', '')::integer,
    greatest(0, coalesce((p_entry ->> 'completionCount')::integer, 0)),
    coalesce((p_entry ->> 'visibility')::public.visibility, 'private'),
    left(coalesce(p_entry ->> 'notes', ''), 10000),
    nullif(p_entry ->> 'startedAt', '')::timestamptz,
    nullif(p_entry ->> 'completedAt', '')::timestamptz
  ) on conflict (user_id, media_item_id) do update set
    status = excluded.status,
    progress = excluded.progress,
    progress_source = excluded.progress_source,
    watched_episodes = excluded.watched_episodes,
    rating = excluded.rating,
    completion_count = excluded.completion_count,
    visibility = excluded.visibility,
    notes = excluded.notes,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at;

  return target_id;
end;
$$;

create function public.remove_library_item(p_provider text, p_type public.media_type, p_external_id text) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.library_entries
  where user_id = auth.uid() and media_item_id = (
    select media_item_id from public.external_identifiers
    where provider = p_provider and entity_type = p_type and external_id = p_external_id
  );
$$;

create function public.get_my_library()
returns table(item jsonb, entry jsonb)
language sql stable security invoker set search_path = public, pg_temp as $$
  select
    jsonb_build_object(
      'id', concat(case ei.provider when 'Open Library' then 'openlibrary' when 'MusicBrainz' then 'musicbrainz' else lower(ei.provider) end, ':', mi.type::text, ':', ei.external_id),
      'externalId', ei.external_id,
      'title', mi.title,
      'type', mi.type,
      'year', mi.year,
      'releaseInfo', mi.release_info,
      'genres', to_jsonb(mi.genres),
      'summary', mi.summary,
      'creator', mi.creator,
      'runtimeMinutes', mi.runtime_minutes,
      'seasons', mi.seasons,
      'posterUrl', mi.poster_url,
      'backdropUrl', mi.backdrop_url,
      'communityRating', mi.community_rating,
      'provider', mi.current_provider,
      'providerUrl', mi.provider_url,
      'catalogRank', mi.catalog_rank
    ),
    jsonb_build_object(
      'userId', le.user_id,
      'itemId', concat(case ei.provider when 'Open Library' then 'openlibrary' when 'MusicBrainz' then 'musicbrainz' else lower(ei.provider) end, ':', mi.type::text, ':', ei.external_id),
      'status', le.status,
      'progress', le.progress,
      'progressSource', le.progress_source,
      'watchedEpisodes', to_jsonb(le.watched_episodes),
      'rating', le.rating,
      'completionCount', le.completion_count,
      'updatedAt', le.updated_at
    )
  from public.library_entries le
  join public.media_items mi on mi.id = le.media_item_id
  join lateral (
    select x.* from public.external_identifiers x
    where x.media_item_id = mi.id
    order by (x.provider = mi.current_provider) desc, x.created_at asc
    limit 1
  ) ei on true
  where le.user_id = auth.uid()
  order by le.updated_at desc;
$$;

revoke all on function public.save_library_item(jsonb, jsonb) from public, anon;
revoke all on function public.remove_library_item(text, public.media_type, text) from public, anon;
revoke all on function public.get_my_library() from public, anon;
grant execute on function public.save_library_item(jsonb, jsonb) to authenticated;
grant execute on function public.remove_library_item(text, public.media_type, text) to authenticated;
grant execute on function public.get_my_library() to authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid), public.is_group_member(uuid, uuid) to authenticated;

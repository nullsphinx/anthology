alter table public.library_entries
  add column review text not null default '',
  add constraint library_entries_review_length check (char_length(review) <= 250);

create or replace function public.save_library_item(p_item jsonb, p_entry jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
  item_type public.media_type;
  item_provider text;
  item_external_id text;
  review_text text := coalesce(p_entry ->> 'review', '');
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(review_text) > 250 then
    raise exception 'review exceeds 250 characters' using errcode = '22023';
  end if;

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
    completion_count, favorite, priority, review, visibility, notes, started_at, completed_at
  ) values (
    actor, target_id,
    coalesce((p_entry ->> 'status')::public.library_status, 'want'),
    least(100, greatest(0, coalesce((p_entry ->> 'progress')::integer, 0))),
    coalesce((p_entry ->> 'progressSource')::public.progress_source, 'manual'),
    coalesce(array(select jsonb_array_elements_text(p_entry -> 'watchedEpisodes'))::integer[], '{}'),
    nullif(p_entry ->> 'rating', '')::integer,
    greatest(0, coalesce((p_entry ->> 'completionCount')::integer, 0)),
    coalesce((p_entry ->> 'favorite')::boolean, false),
    coalesce((p_entry ->> 'priority')::boolean, false),
    review_text,
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
    favorite = excluded.favorite,
    priority = excluded.priority,
    review = excluded.review,
    visibility = excluded.visibility,
    notes = excluded.notes,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at;

  return target_id;
end;
$$;

create or replace function public.get_my_library()
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
      'favorite', le.favorite,
      'priority', le.priority,
      'review', le.review,
      'completedAt', le.completed_at,
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

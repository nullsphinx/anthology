alter table public.profiles
  add column next_up_item_ids jsonb not null default '{}'::jsonb,
  add constraint profiles_next_up_item_ids_valid check (public.valid_profile_showcases(next_up_item_ids));

create or replace function public.get_public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with target_profile as (
    select p.*
    from public.profiles p
    where p.username = lower(trim(p_username))
      and p.visibility = 'public'
    limit 1
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'userId', p.user_id,
      'username', p.username,
      'displayName', p.display_name,
      'avatarUrl', p.avatar_url,
      'visibility', p.visibility,
      'showcaseItemIds', p.showcase_item_ids,
      'nextUpItemIds', p.next_up_item_ids
    ),
    'library', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', jsonb_build_object(
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
        'entry', jsonb_build_object(
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
          'review', '',
          'completedAt', le.completed_at,
          'updatedAt', le.updated_at
        )
      ) order by le.updated_at desc)
      from public.library_entries le
      join public.media_items mi on mi.id = le.media_item_id
      join lateral (
        select x.* from public.external_identifiers x
        where x.media_item_id = mi.id
        order by (x.provider = mi.current_provider) desc, x.created_at asc
        limit 1
      ) ei on true
      where le.user_id = p.user_id
    ), '[]'::jsonb)
  )
  from target_profile p;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

comment on function public.get_public_profile(text) is
  'Returns profile shelf data only when the profile owner has explicitly selected public visibility; reviews are never exposed.';

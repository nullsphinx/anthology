begin;
select plan(25);

insert into public.invites (email)
values ('owner@example.test'), ('invited@example.test'), ('expired@example.test');
update public.invites set expires_at = now() - interval '1 minute' where email = 'expired@example.test';

select is(
  public.hook_allow_invited_user('{"user":{"email":"INVITED@example.test"}}'::jsonb),
  '{}'::jsonb,
  'the auth hook allows a non-expired invited email case-insensitively'
);
select is(
  public.hook_allow_invited_user('{"user":{"email":"uninvited@example.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'the auth hook rejects an uninvited email'
);
select is(
  public.hook_allow_invited_user('{"user":{"email":"expired@example.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'the auth hook rejects an expired invitation'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), now(), now());

select is(
  (select claimed_by from public.invites where email = 'owner@example.test'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'creating an invited user claims their invitation'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles set display_name = 'Owner', username = 'owner' where user_id = '00000000-0000-0000-0000-000000000001' $$,
  'a user can update their own profile'
);
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'), 'Owner', 'own profile is visible');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000002'), 0, 'private profiles are hidden');

select lives_ok(
  $$ select public.save_library_item(
    '{"type":"movie","provider":"TMDB","externalId":"550","title":"Fight Club","year":1999,"releaseInfo":"1999","genres":["Drama"],"summary":"","creator":"David Fincher","communityRating":8.4,"providerUrl":"https://www.themoviedb.org/movie/550"}'::jsonb,
    '{"status":"completed","progress":100,"progressSource":"manual","watchedEpisodes":[],"rating":90,"completionCount":2,"favorite":true,"priority":false,"review":"<script>alert(1)</script> '' OR 1=1 --","completedAt":"2026-09-13T00:00:00Z"}'::jsonb
  ) $$,
  'authenticated users can save a validated catalog item'
);
select is((select count(*)::integer from public.library_entries), 1, 'the owner sees their library entry');
select is((select count(*)::integer from public.get_my_library()), 1, 'the owner can load their normalized library');
select is((select favorite from public.library_entries), true, 'favorite state is persisted');
select is((select (entry ->> 'completionCount')::integer from public.get_my_library()), 2, 'repeat completion count is returned to the client');
select is((select review from public.library_entries), '<script>alert(1)</script> '' OR 1=1 --', 'review content is persisted strictly as inert text');
select throws_ok(
  $$ select public.save_library_item('{}'::jsonb, jsonb_build_object('review', repeat('x', 251))) $$,
  '22023',
  'review exceeds 250 characters',
  'the database rejects reviews over 250 characters'
);
select lives_ok(
  $$ update public.profiles set visibility = 'public', showcase_item_ids = '{"movie":["tmdb:movie:550"]}'::jsonb where user_id = '00000000-0000-0000-0000-000000000001' $$,
  'an owner can publish a profile with a validated showcase'
);
select ok(public.valid_profile_showcases('{"movie":["1","2","3","4","5","6","7","8","9","10"]}'::jsonb), 'a shelf accepts ten featured items');
select ok(public.valid_profile_showcases('{"movie":["1","2","3","4","5","6","7","8","9","10","11","12"]}'::jsonb), 'a shelf accepts twelve featured items');
select is(public.get_public_profile('OWNER') -> 'profile' ->> 'displayName', 'Owner', 'public profile lookup is case-insensitive');
select is(jsonb_array_length(public.get_public_profile('owner') -> 'library'), 1, 'a public profile includes its shelf');
select is(public.get_public_profile('owner') -> 'library' -> 0 -> 'entry' ->> 'review', '', 'public profile data never exposes reviews');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.library_entries), 0, 'another user cannot read a private entry');
select is(jsonb_array_length(public.get_public_profile('owner') -> 'library'), 1, 'a viewer can load a deliberately public profile despite entry-level privacy');
select lives_ok(
  $$ update public.profiles set display_name = 'Stolen' where user_id = '00000000-0000-0000-0000-000000000001' $$,
  'an unauthorized update is safely filtered'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'), 'Owner', 'another user cannot change the owner profile');
update public.profiles set visibility = 'private' where user_id = '00000000-0000-0000-0000-000000000001';
select is(public.get_public_profile('owner'), null, 'private profiles are indistinguishable from missing profiles to the share endpoint');

select * from finish();
rollback;

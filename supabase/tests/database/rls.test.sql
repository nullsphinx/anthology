begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles set display_name = 'Owner' where user_id = '00000000-0000-0000-0000-000000000001' $$,
  'a user can update their own profile'
);
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'), 'Owner', 'own profile is visible');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000002'), 0, 'private profiles are hidden');

select lives_ok(
  $$ select public.save_library_item(
    '{"type":"movie","provider":"TMDB","externalId":"550","title":"Fight Club","year":1999,"releaseInfo":"1999","genres":["Drama"],"summary":"","creator":"David Fincher","communityRating":8.4,"providerUrl":"https://www.themoviedb.org/movie/550"}'::jsonb,
    '{"status":"completed","progress":100,"progressSource":"manual","watchedEpisodes":[],"rating":90,"completionCount":1}'::jsonb
  ) $$,
  'authenticated users can save a validated catalog item'
);
select is((select count(*)::integer from public.library_entries), 1, 'the owner sees their library entry');
select is((select count(*)::integer from public.get_my_library()), 1, 'the owner can load their normalized library');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.library_entries), 0, 'another user cannot read a private entry');
select lives_ok(
  $$ update public.profiles set display_name = 'Stolen' where user_id = '00000000-0000-0000-0000-000000000001' $$,
  'an unauthorized update is safely filtered'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'), 'Owner', 'another user cannot change the owner profile');

select * from finish();
rollback;

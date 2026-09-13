create function public.hook_allow_invited_user(event jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  signup_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if signup_email is not null and exists (
    select 1
    from public.invites
    where lower(email::text) = signup_email
      and claimed_by is null
      and (expires_at is null or expires_at > now())
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This private alpha requires an invitation.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_allow_invited_user(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_allow_invited_user(jsonb) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (user_id) do nothing;

  update public.invites
  set claimed_by = new.id,
      claimed_at = coalesce(claimed_at, now())
  where email = new.email
    and claimed_by is null;

  return new;
end;
$$;

update public.invites as invite
set claimed_by = users.id,
    claimed_at = coalesce(invite.claimed_at, users.created_at, now())
from auth.users as users
where invite.email = users.email
  and invite.claimed_by is null;

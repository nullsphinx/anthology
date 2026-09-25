-- Self-service invitations grant signup eligibility, never an authenticated session.
-- Supabase Auth still verifies mailbox ownership and rate-limits email delivery.
create function public.request_invite(p_email text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
begin
  if normalized_email is null
    or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  insert into public.invites (email, expires_at)
  values (normalized_email, now() + interval '24 hours')
  on conflict (email) do update
    set expires_at = excluded.expires_at
    -- Do not reopen claimed invites or shorten administrator-issued invitations.
    where public.invites.claimed_by is null
      and public.invites.expires_at < now();
end;
$$;

revoke all on function public.request_invite(text) from public;
grant execute on function public.request_invite(text) to anon, authenticated;

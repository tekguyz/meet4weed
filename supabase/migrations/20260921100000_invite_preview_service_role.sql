-- ---------------------------------------------------------------------------
-- Plan 04, ticket #31 — the cold invite path needs one grant
--
-- A visitor with NO ACCOUNT now sees the same invite page a member sees, so
-- the preview has to be readable with no session. public.invite_preview() is
-- granted to `authenticated` and deliberately NOT to `anon`: the anon key
-- reaches the Data API straight from a browser, and a function that answers
-- it is a function anybody can guess at all day.
--
-- So the server reads it for them, with the service-role key, after checking
-- the token's HMAC tag — see lib/sesh/invite-reads.ts. That check is the real
-- gate: without VERIFICATION_SECRET nobody can put a token in front of this
-- function at all.
--
-- AND SERVICE_ROLE COULD NOT EXECUTE IT. `service_role` bypasses row
-- *policies* (BYPASSRLS), not *privileges*, and privileges are checked first.
-- Every private.* helper in …_invites.sql already names service_role for this
-- exact reason; the three public.* functions did not, because until now every
-- caller of them held a member's session. Proved, not read: calling
-- invite_preview with the secret key raised
--   42501  permission denied for function invite_preview
-- which would have been EVERY signed-out invite page in production.
--
-- ONLY invite_preview. mint_invite, revoke_invite and redeem_invite are
-- always called as the member doing the thing — that is what makes
-- auth.uid() inside them mean anything — and granting service_role EXECUTE on
-- redeem_invite would create a way to spend a use with no member attached.
-- They stay exactly as they are.
-- ---------------------------------------------------------------------------

grant execute on function public.invite_preview(text) to service_role;

comment on function public.invite_preview(text) is
  'Title and start time only, and spends nothing. A GET must never burn a use — a chat app would eat the link drawing a preview card. Readable by service_role so the server can render the page for a visitor with no account (#31).';

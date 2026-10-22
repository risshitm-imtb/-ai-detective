# Security and operational model

## Participant access

- Participants do not use Supabase Auth. Registration accepts only Team Name, Team Lead Name, and USN.
- USNs are normalized by trimming outer whitespace, removing internal whitespace, and uppercasing. The database has a unique index on the normalized value, so one USN can register only once.
- A trusted server endpoint creates a cryptographically random participant token. It sends that token only as an HttpOnly, SameSite=Strict cookie (Secure on HTTPS); JavaScript cannot read it, and it is never put in localStorage or sessionStorage. The database stores only the SHA-256 digest. Sessions expire after 180 days.
- The API checks request origin, rate-limits registration by a server-keyed hash of the caller IP (10 attempts per hour), validates session cookies, and calls narrowly scoped database functions. Participant session and rate-limit tables have RLS enabled and no grants to public, anon, or authenticated roles.
- Only the service-role key can execute guest registration, participant-state, and participant-submission RPCs. It is required only by the same-origin server API and must be stored as `SUPABASE_SERVICE_ROLE_KEY`, never with a `VITE_` prefix. It must not be committed, returned by an API, logged, or included in frontend bundles.
- Participant state returns only the registered team’s submissions, scores, and qualifications. Challenges are limited to the active/revealed eligible round. Explanations and answer keys are returned only after that team's round results are revealed. Participants cannot write scores, qualification flags, deadlines, or event controls.

## Organizer access and event integrity

- Supabase Auth remains for organizers only. The trusted project administrator provisions organizer UUIDs in `public.organizers`; UI visibility is not authorization.
- Organizer RPCs continue to call `assert_organizer()` or `is_organizer()` and verify `auth.uid()` against `public.organizers`. Organizer authentication remains separate from the participant cookie.
- Existing Auth-backed teams and submissions are preserved by the guest migration. New teams use a nullable legacy captain reference and a guest team lead record.
- The browser never chooses official start/deadline timestamps, scores, qualification, membership roles, or organizer permissions. The database checks event state, qualification, and deadline for every submission.
- Registering a team does not start the event or a round. Existing organizer controls remain the only way to start or advance rounds.
- Expiry finalization remains request-driven: a participant-state or organizer-state request after a deadline may finalize that expired round. There is no background scheduler if all clients disconnect.

## Secrets and verification

Only the Supabase URL and public anon key are browser configuration. Keep database passwords, service-role keys, and deploy credentials in trusted server-side environment settings. `.env*` is ignored except `.env.example`.

The guest registration migration must be applied before registration can work. Verify it on a staging project first. The frontend build does not establish that a remote migration, service key, API function, cookie, RLS policy, or live organizer control works. Test those against a disposable/staging Supabase project before opening registration.

Team lead names and USNs are personal data. Limit access to the organizer dashboard and set an appropriate retention/deletion plan before collecting real registrations.

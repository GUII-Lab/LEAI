# LEAI same-origin Heroku deployment

Decision approved by Harvey on 2026-09-26 (verification continued 2026-09-27 UTC).
This supersedes Pages hosting and browser-stored instructor bearer credentials in earlier architecture documents. It does not authorize a Production cutover.

## Target

Each environment has one Heroku app serving the built React frontend through WhiteNoise and Django APIs through Gunicorn. Use the actual default HTTPS domain reported by Heroku; no purchased domain is required. QA and Production use separate apps, credentials, and PostgreSQL schemas in their existing shared database: `leai_qa` for QA and `public` for Production. `/` and `/InstructorLogin.html` serve the frontend; `/datapipeline/api/v1/` is the API. There is no extra proxy/BFF service, no Vercel function, and no shared browser cookie across environments.

GitHub remains source control and CI. `GUII-Lab/LEAI` is the sole frontend source; `guiidatapipelines` remains the backend source. Retired frontend repositories are not deployment inputs. Pages build utilities remain historical verification tooling, not the new app release route.

## Authentication boundary

- Django database-backed sessions; hosted cookie `__Host-leai-session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain` attribute.
- Login returns only expiry and legacy metadata, never the session credential. No instructor credential in localStorage/sessionStorage. Existing stale instructor storage entries are discarded.
- GET `instructor_csrf/` returns a masked token with `Cache-Control: no-store`. All instructor mutations, including login/logout, require Django CSRF validation. Fetch is same-origin only and rejects redirects; foreign origins are not trusted.
- Server checks expiry, revocation, active user/account, and course authorization. Login, reauthentication and password changes rotate browser credentials; password changes revoke other instructor sessions. Logout flushes the Django session and revokes its LEAI record.
- Student occurrence-scoped capabilities, existing consent, and chat UI remain separate and unchanged. Research debug requires an authenticated, authorized Researcher cookie session; an anonymous student capability does not grant access.
- Password change stays optional. This work does not introduce SSO/MFA, email recovery, or forced first-login rotation.

## Build and package

1. Review and commit the intended frontend and backend work on their current branches. Both working trees currently contain substantial unfinished work; do not stage unrelated changes or deploy a dirty snapshot as a commit-identical release.
2. Run frontend unit/component tests, script tests, typecheck, lint, and real browser tests. Run the complete Django suite on an isolated PostgreSQL database.
3. Resolve the actual committed backend SHA. In LEAI run:

   ```sh
   npm run build:heroku -- qa <exact-40-character-backend-sha>
   ```

   For a later approved Production candidate use `production` instead of `qa`. Output is `dist/heroku/<environment>/`. It includes `leai-build-manifest.json` with frontend SHA, backend SHA, environment, schema, root path, relative API path, and dirty-source flag. Hosted startup rejects dirty, missing, or mismatched frontend identity. Building a Production candidate is not deploying it.
4. Assemble an isolated release directory from `git archive` of that exact backend commit. Copy only the matching public Vite output to `frontend_dist/`; never copy `.env`, working directories, private data, or node_modules. Preserve a separate release record containing both commit IDs and the final artifact digest. Do not use a live backend checkout as the staging directory.
5. Before upload, scan the frontend output with `node scripts/check-client-secrets.mjs dist/heroku/qa`. Verify the packaged backend contains the new hosting code, authentication migrations, and matching dependencies. Review `Procfile` release migration scope before any remote deployment.

## Heroku QA preflight

Heroku access confirmed that the QA and Production apps attach the same PostgreSQL add-on. QA already has the `leai_qa` schema, while Production uses `public`. The owner chose to keep this topology. PostgreSQL schemas organize names; they are not a strong isolation boundary when the same database role can access both. The release must set `LEAI_ENVIRONMENT=qa` and `LEAI_DB_SCHEMA=leai_qa`, and the backend must pin the connection search path before the release-phase migration.

- Recheck the actual QA app, default URL, stack/buildpack/runtime, release, and database attachment without printing credentials/config dumps. Record a database backup/recovery point before migrating `leai_qa`.
- Set `LEAI_SERVE_FRONTEND=1`, `LEAI_ENVIRONMENT=qa`, and `LEAI_BUILD_ID=<packaged-backend-sha>`.
- Set `DJANGO_ALLOWED_HOSTS` to the actual hostname only; `HEROKU_APP_DEFAULT_DOMAIN_NAME` is the fallback when available. Do not infer a hostname by appending `.herokuapp.com` to an app name.
- Use a strong independent `SECRET_KEY` and QA-only provider credentials. Keep `DATABASE_URL` in Heroku, never in frontend variables.
- The canonical handshake expects QA schema `leai_qa`, Production schema `public`. Verify PostgreSQL `current_schema()` under the app's actual connection and inspect the migration plan before applying migrations. Confirm Production `public` table and migration counts remain unchanged afterward. Frontend schema/build mismatches fail closed.
- Keep uploads/outputs off the dyno filesystem; it is not durable storage. This change only serves immutable public frontend build files.
- Deploy QA only, wait for the release to finish, then verify HTTPS, HSTS, Secure cookie flags, redirects, login/reload/logout/password rotation, CSRF rejection, private API access, student consent/resume, environment identity, and database persistence on the actual Heroku URL. A local test does not prove cloud behavior.
- Retain the prior app release and compatible data backup for rollback. Do not deploy Production until QA is accepted and the user approves that action.

## Timeout boundary

Same-origin hosting solves the cross-site session deployment problem; it does not remove Heroku router request limits. Long AI/export work still needs the separately planned durable-job workflow. Do not claim a larger Gunicorn timeout bypasses the router limit.

## Local verification

Built React + Gunicorn + isolated PostgreSQL were exercised on `http://127.0.0.1:8182`, without API interception, in Chromium/Firefox/WebKit. The screenshot report is `/private/tmp/verification-report-leai-heroku-2026-09-27.html`. Temporary synthetic credentials and data stay outside Git. Cloud HTTPS and database isolation remain unverified until Heroku access is restored.

## References

- [Django AJAX CSRF protection](https://docs.djangoproject.com/en/5.2/howto/csrf/)
- [Django session settings](https://docs.djangoproject.com/en/5.2/ref/settings/#sessions)
- [WhiteNoise Django integration](https://whitenoise.readthedocs.io/en/stable/django.html)
- [Heroku default domains](https://devcenter.heroku.com/articles/app-names-and-subdomains)
- [Heroku request timeouts](https://devcenter.heroku.com/articles/request-timeout)

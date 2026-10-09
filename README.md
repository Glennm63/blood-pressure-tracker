# Pressure — cloud version

This version is prepared for GitHub and Vercel. It has not yet been connected to a live Supabase project or deployed. The original live device-only app remains unchanged. Do not use the older ZIP for cloud storage.

Users create an account and sign in using their email and password. No email delivery service is required. Every successful save goes to Supabase PostgreSQL. Clearing browser data removes the login session, but confirmed cloud readings are retrieved after signing in again with the same email. Users have separate records, enforced by database row-level security. Readings are not cached in browser storage by this version. Internet access is required for reading and writing. Unsaved form entries are not protected against closing the page or clearing browser data.

Latest readings, history, graphs and 7/30/365-day averages are retained. CSV/JSON backups remain available. Database owners and administrators retain administrative access; this is not end-to-end encryption.

## 1. Create and configure Supabase

1. Create a Supabase project in your own account. Choose a suitable region, such as Sydney if available. Keep the database password private.
2. Run the entire `database/schema.sql` once in the SQL Editor. It creates only `public.pressure_readings` and its four access policies, transactionally. It will stop rather than silently overwrite an existing table.
3. Enable the Email authentication provider and allow new user signups. Turn **Confirm email** off under Authentication → Sign In / Providers so signup returns a session without sending email. This setting is required; the app cannot change it.
4. Email templates and custom SMTP are not required. The email is an unverified account identifier. Users must use the same email and password on each phone. Password recovery is manual: users contact the app administrator, who verifies their identity and sets a new password on their existing account. No recovery email or SMTP provider is needed. Save passwords in a password manager. See the manual reset instructions below.
5. Set the Site URL to your final Vercel production URL and use its exact origin for any required redirect configuration.
6. Copy the project's HTTPS URL and **publishable key** from the project settings. The legacy **anon key** also works. These values are intended for the browser and are safe to include only with the supplied access policies active. Never use a service-role key, secret key, database password or personal access token in the app.

## 2. GitHub and Vercel

1. Create the `pressure-app` GitHub repository (private recommended) or provide its URL to upload this package. Upload the extracted contents, not the ZIP. Preserve the `public`, `database` and `tests` directories.
2. Import the repository into Vercel, with the repository root as Root Directory. `vercel.json` sets the build command, skips dependency installation and publishes `public` only. SQL, tests and environment examples are excluded from the served website.
3. Add these variables to the Vercel project's Production environment (also Preview if using previews):
   - `SUPABASE_URL`: your project URL.
   - `SUPABASE_PUBLISHABLE_KEY`: your publishable or legacy anon key.
4. Deploy. The build will fail if either value is missing or invalid, or if a secret/service-role key is used. It generates `public/config.js` using only the two public values.
5. Open the deployed URL in Safari, create an account or sign in with email and password, and add Pressure to the Home Screen using Share → Add to Home Screen.

## 3. Transfer existing readings

- **Same browser and URL:** after first sign-in, the app shows any device-only readings still present and asks before uploading them. Confirm only if they belong to the signed-in person. The old copy is retained, and uploads are safe to retry because IDs are preserved.
- **Different URL, phone, or installed app:** before changing, open the old app and select Options → Save backup (JSON). Sign in to the new app, then Options → Restore a backup. Existing cloud entries with the same ID are preserved.
- Each user must transfer their own readings to their own account. Device-only records have no recorded owner, so the app cannot safely assign them automatically. Do not clear old browser data until migration is confirmed and the cloud copy can be retrieved.

## 4. Verify activation before relying on it

1. Sign in with two different emails. Save a test reading in each and verify neither account sees the other's readings.
2. Confirm a test reading is saved, sign out, clear browser site data, sign in with the same email and verify the reading returns.
3. Open on a second phone using the same email and verify the reading returns.
4. Disconnect the internet and attempt a save. The form must remain open and no success message should appear. Reconnect and retry.
5. Test old JSON import, duplicates, edit/delete, graphs and all averages. Keep backups in addition to the cloud database.

## Validation and limitations

`npm ci && npm test` runs the supplied DOM and PostgreSQL tests (Node 22+). Vercel does not install these test dependencies. Tests cover acknowledged cloud writes, network failures, browser-clearing recovery using a persistent backend stub, account switching, stale response protection, migration idempotence, safe note rendering, averages, configuration validation and the actual supplied PostgreSQL access policies using PGlite. The PGlite fixture emulates Supabase roles and `auth.uid()`; it is not a hosted Supabase integration test.

Hosted password authentication, project configuration, iPhone UI and Vercel deployment still require activation tests. Cloud storage protects confirmed readings from browser clearing; it does not prevent deliberate deletion or provider/account loss. Arrange database backups appropriate to your chosen service plan. There is no diagnosis or treatment advice.

## Included dependency

The browser bundle of the official Supabase JavaScript SDK is vendored at `public/vendor/supabase.js`, version 2.117.3, with its MIT license. No runtime CDN or npm installation is needed to deploy. A small replacement service worker removes the device-only version's offline cache when upgrading the same URL; cloud records are never stored in that cache.

Official references:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys

## Manual password resets (administrator only)

The login screen’s **Forgot password?** button explains how to request a manual reset. It does not send an email or reset anything automatically. Tell your users how to contact you when inviting them to the app. Verify their identity through a trusted channel; knowing an account email alone is not proof of ownership.

From an interactive terminal in the repository root:

```sh
python3 scripts/manual-password-reset.py --check
python3 scripts/manual-password-reset.py
```

Configure `SUPABASE_URL` and `SUPABASE_ACCESS_TOKEN` securely in the administrator’s cloud environment. The access token must have administrative access to the selected project, and network access must allow `api.supabase.com` and the project hostname. Never put the access token or service-role key in the website, Vercel app variables, source control, chat, or logs. The tool retrieves the project’s service-role key into memory and uses the Supabase Admin API; only `public` is deployed by the existing Vercel configuration.

The tool finds the existing account by email, requires confirmation of the email, and prompts for the new password twice with hidden input. It updates only the password; it does not create another account, change the user ID, confirm an email, or modify readings. Share the new password privately with the verified account owner, who then signs in using their existing email. There is no automatic requirement to change this password at next login. Revoke temporary administrative access when you no longer need it.

Validation: `PYTHONDONTWRITEBYTECODE=1 python3 tests/manual-password-reset.py` exercises account selection and password updates with mocked requests. `--check` verifies real administrative connectivity without changing accounts. An actual password reset is performed only when an administrator selects and confirms a user.


## Passkey sign-in

Sign in with your existing email and password, then choose **Options → Add a passkey**. Complete your device's Face ID, Touch ID, PIN, or security-key prompt. On later visits, select **Sign in with a passkey** without entering your email. Password sign-in and manual password recovery remain available. Passkeys require HTTPS and a WebAuthn-capable browser; enrollment requires a confirmed, non-anonymous Supabase account.

Enable **Authentication → Passkeys** in Supabase. Use display name `Pressure`, relying-party ID `blood-pressure-tracker-ashy.vercel.app`, and origin `https://blood-pressure-tracker-ashy.vercel.app`. Keep the relying-party ID stable: changing it makes existing passkeys unusable. Passkeys created for this domain cannot sign in on unrelated Vercel preview domains. The bundled SDK supports passkeys and the client explicitly opts into Supabase's experimental passkey API.

Passkeys are verified and stored by Supabase Auth, not by browser storage or the readings table. Validate enrollment and sign-in on the production domain using a real device. Supabase's passkey API is experimental and may change.

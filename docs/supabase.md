# Supabase setup

Supabase is where Almanac keeps everything: conversations, contacts,
deals, logins and uploaded files. The free plan is enough for a small
business to start. This page covers what to click and the few things
that trip people up.

## Create the project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**.
2. **Name:** anything, e.g. `almanac`.
3. **Database password:** click **Generate a password** and save it in
   your password manager. The installer asks for it once, to create the
   tables. Supabase can't show it to you again (you can reset it under
   **Project Settings → Database**).
4. **Region:** pick the one closest to your customers. For India choose
   **Mumbai (ap-south-1)**. You can't change this later.
5. Click **Create new project** and wait a minute or two.

## The three keys the installer asks for

Open **Project Settings → API** (in newer dashboards: **Project Settings
→ API Keys** and **Data API**).

| Installer asks for | Where to find it | Looks like |
|---|---|---|
| Project URL | *Project URL* | `https://abcd1234.supabase.co` |
| anon public key | *anon* / *public* key | a long string starting `eyJ` or `sb_publishable_` |
| service_role secret key | *service_role* / *secret* key (click **Reveal**) | a long string starting `eyJ` or `sb_secret_` |

> **Keep the service_role key secret.** It bypasses every security rule
> in your database. It only ever goes into `.env.local` on your server,
> never into a browser, a chat or a screenshot.

## Let people sign up

By default Supabase asks every new user to confirm their email, and its
built-in mail service is deliberately limited: it only sends to members
of your Supabase team, and only a few emails an hour. Pick one:

- **Just you (or you and a partner):** sign up in Almanac with the same
  email you use for Supabase, and the confirmation arrives normally.
- **Skip confirmation:** **Authentication → Sign In / Providers → Email**,
  turn off **Confirm email**. Fine when only people you invite will
  ever see the sign-up page.
- **Proper email (recommended once you have staff):** **Authentication →
  Emails → SMTP Settings**, and plug in a mail provider such as Resend,
  Brevo or Amazon SES. Their free tiers are plenty.

Then set where login links point: **Authentication → URL Configuration**

- **Site URL:** your Almanac address, e.g. `https://crm.yourshop.in`
  (`http://localhost:3000` while testing on your laptop).
- **Redirect URLs:** add the same address with `/**` on the end.

## Things worth knowing

- **Free projects pause after a week without activity.** A business
  using Almanac daily never hits this. If it happens, open the project
  in Supabase and click **Restore**; nothing is lost. The Pro plan never
  pauses.
- **Storage:** photos, voice notes and documents from chats are kept in
  Supabase Storage. The free plan includes 1 GB; check **Usage** now and
  then if you send a lot of media.
- **Backups:** the free plan has no restorable backups. Take your own
  with `npx supabase db dump -f backup.sql` inside the Almanac folder, or
  move to Pro for daily backups once your business depends on it.
- **Updates:** when an Almanac update adds a database change, re-run the
  installer (or `npx supabase db push` in the folder). It only applies
  what's new.
- **Resetting everything:** delete the project in Supabase, create a new
  one and run the installer again with the new keys.

Next: [WhatsApp setup](./whatsapp-setup.md).

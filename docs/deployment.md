# Deploying Almanac

Almanac is a standard Next.js app backed by Supabase. Anything that runs
Node.js 20+ can host it. Pick whichever you already know.

Whatever you choose, set the same variables as in `.env.local` (see
`.env.local.example`), plus `NEXT_PUBLIC_SITE_URL` set to your public
address, e.g. `https://crm.yourshop.in`. `NEXT_PUBLIC_*` values are baked
in at build time, so rebuild after changing them.

## Vercel

The quickest start for a one-person business.

1. **Fork** [trulytuhin/almanac-crm](https://github.com/trulytuhin/almanac-crm)
   on GitHub (the **Fork** button, top right), then import your fork in
   Vercel. Forking is what lets you pull in updates later with one click.
2. Add the environment variables under **Settings → Environment
   Variables**.
3. Deploy, then add your domain under **Settings → Domains**.

The Hobby plan's cron runs at most once a day and can't send the
`x-cron-secret` header Almanac expects, so use an external pinger for the
scheduled jobs ([automations-and-cron.md](./automations-and-cron.md)).

## A VPS with Docker

Good for a small team that wants everything on one box (a 1 GB
DigitalOcean, Hetzner or Lightsail machine is enough).

SSH in, install Node.js 20+ and Docker, then let the installer write the
config and set up the database without starting a dev copy:

```bash
curl -fsSL https://almanac.bar/install.sh | bash -s -- --no-start
cd almanac-crm
docker compose --env-file .env.local up --build -d
```

Put Caddy or nginx in front for HTTPS. With Caddy that's one line:

```
crm.yourshop.in {
  reverse_proxy localhost:3000
}
```

Add the cron calls to the machine's crontab. Details and the build-arg
notes are in [docker.md](./docker.md).

## Any Node host

On a machine you can SSH into, `curl -fsSL https://almanac.bar/install.sh | bash`
does everything below. Keep it running after you log out with a process
manager, e.g. `npx pm2 start npm --name almanac -- start`. By hand:

```bash
npm ci
npm run build
npm start          # listens on $PORT, default 3000
```

Managed Node hosts (Railway, Render, Hostinger and others) run exactly
these commands. Point the start command at `npm start`.

## After deploying

1. In Supabase, **Authentication → URL Configuration**: set the Site URL
   to your public address and add it to the redirect allow-list.
2. In Meta, point the WhatsApp webhook at
   `https://<your host>/api/whatsapp/webhook` (see
   [getting-started.md](./getting-started.md#3-connect-whatsapp)).
3. Schedule the cron endpoints.
4. Send yourself a WhatsApp message and watch it land in the inbox.

## Updating

- **Installed with the one-liner** (your computer, a VPS, any Node
  host): run `almanac update`, or click **Update now** in **Settings →
  Updates**. It downloads the new version, applies any database changes,
  rebuilds and restarts.
- **Vercel:** open your fork on GitHub and click **Sync fork → Update
  branch**. Vercel redeploys on its own. If the update includes database
  changes (Settings → Updates lists them), run `npx supabase db push` from
  a local copy once.
- **Docker:** `git pull`, then `docker compose --env-file .env.local up --build -d`.

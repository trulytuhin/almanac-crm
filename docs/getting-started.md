# Getting started

This takes about an hour the first time, most of it inside Meta's
dashboards. You need:

- a [Supabase](https://supabase.com) account (the free tier is enough to start),
- a [Meta for Developers](https://developers.facebook.com) account and a
  Meta Business portfolio,
- a phone number that is **not** already on the WhatsApp app (or one you
  are willing to move to the WhatsApp Business Platform),
- Node.js 20 or newer.

## Before you start

Have these ready. The installer asks for them.

1. **A Supabase project** (free). You'll paste its URL and two keys, and
   type the database password once. [How to create it](./supabase.md).
2. **A Meta app with WhatsApp added** (free). You'll paste its App ID and
   App secret. [How to create it](./whatsapp-setup.md#1-create-the-meta-app).

## 1. Install

**macOS / Linux**

```bash
curl -fsSL https://almanac.bar/install.sh | bash
```

**Windows** (cmd or PowerShell)

```bat
powershell -c "irm https://almanac.bar/install.ps1 | iex"
```

The installer:

1. checks for git and Node.js 20+,
2. downloads Almanac into `./almanac-crm` (set `ALMANAC_DIR` to choose another folder),
3. installs dependencies,
4. runs the setup wizard (`npm run setup`), which
   - asks for your Supabase and Meta keys and your public address,
   - generates `ENCRYPTION_KEY` and `AUTOMATION_CRON_SECRET` and writes `.env.local`,
   - logs in to Supabase, links your project and creates every table (you'll be
     asked for the database password once),
   - builds and starts Almanac on <http://localhost:3000>.

Open it, sign up, and you land on the dashboard. Each sign-up gets its own
account with that person as owner. Teammates join through invite links.

Running the installer again updates Almanac and keeps your settings. The
wizard alone is `npm run setup` inside the folder. It takes `--skip-db`,
`--no-start` and `--yes` (use defaults; every value can also come from an
environment variable of the same name, handy for servers and CI).

### Doing it by hand

```bash
git clone https://github.com/trulytuhin/almanac-crm.git
cd almanac-crm
npm install
cp .env.local.example .env.local   # fill it in; see the comments
npx supabase link --project-ref <your-ref> && npx supabase db push
npm run build && npm start
```

Generate `ENCRYPTION_KEY` with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Keep it safe: changing it later means reconnecting WhatsApp.

## 2. Finish the Supabase settings

Set the Site URL and decide how sign-up emails are sent. Two minutes,
explained in [Supabase setup → Let people sign up](./supabase.md#let-people-sign-up).

## 3. Connect WhatsApp

Create a permanent token, paste your IDs into **Settings → WhatsApp** and
point Meta's webhook at Almanac. Step by step, including where
everything lives: [WhatsApp setup](./whatsapp-setup.md).

## 4. Turn on scheduled jobs

Automations with a **Wait** step and abandoned chatbot flows are handled
by two cron endpoints. Set `AUTOMATION_CRON_SECRET` and call them every
few minutes. See [automations-and-cron.md](./automations-and-cron.md).

## 5. Make it yours

- **Currency.** New accounts start in rupees (₹). Change it under
  **Settings → Deals & currency**.
- **Pipeline.** The first pipeline comes with *New enquiry, Interested,
  Quote sent, Payment pending, Won*. Rename or reorder stages from the
  pipeline settings.
- **Templates.** WhatsApp only lets you message a customer first, or
  more than 24 hours after their last message, with a Meta-approved
  template. Create them under **Settings → Templates**.
- **Team.** Working alone? Nothing to do. Hiring? Invite teammates from
  **Settings → Team members** and give them the agent role.
- **Language.** Set `NEXT_PUBLIC_APP_LOCALE` to `en`, `pt`, `es` or `ko`
  and rebuild.
- **AI replies.** Add your own OpenAI or Anthropic key under **AI Agents
  → Setup**. [AI features](./ai-byok.md).

Next: learn the app in [Using Almanac](./user-guide.md).

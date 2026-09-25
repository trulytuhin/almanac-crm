# Troubleshooting

The problems people actually hit, and the fix for each. Still stuck?
Email [tuhin@almanac.bar](mailto:tuhin@almanac.bar) with what you tried
and a screenshot.

## Installing

| Problem | Fix |
|---|---|
| "git is missing" / "Node.js is missing" | Install them (the message has the link or `winget` command), open a **new** terminal window, run the one-liner again |
| "Node.js … is too old" | Install the current LTS from [nodejs.org](https://nodejs.org) |
| The installer stopped halfway | Run the same one-liner again. It picks up where it left off and keeps your settings |
| Wrong key typed during setup | In the `almanac-crm` folder run `npm run setup`. It shows your saved values; press Enter to keep, or type a new one |
| "Could not link the Supabase project" | The database password is wrong. Reset it in Supabase (**Project Settings → Database**) and run `npm run setup` again |
| Port 3000 is in use | Start on another port: `PORT=3001 npm start` (Windows cmd: `set PORT=3001`, then `npm start`) |

## Signing in

| Problem | Fix |
|---|---|
| No confirmation email arrives | Supabase's built-in mail only reaches your Supabase team. See [Let people sign up](./supabase.md#let-people-sign-up) |
| Login link opens `localhost` | Set the Site URL in Supabase: **Authentication → URL Configuration** |
| A teammate's invite link doesn't work | Links expire after 7 days by default. Create a new one in **Settings → Team members** |

## WhatsApp

| Problem | Fix |
|---|---|
| Saving WhatsApp settings fails | Almanac names the field to fix. Details in [connection troubleshooting](./whatsapp-connection-troubleshooting.md) |
| Messages don't reach the inbox | Webhook not subscribed to `messages`, app not in **Live** mode, or the callback URL isn't public `https`. See [step 5](./whatsapp-setup.md#5-point-metas-webhook-at-almanac) |
| It worked yesterday, now "Invalid OAuth access token" | You used the 24-hour token. Create a [permanent token](./whatsapp-setup.md#3-create-a-permanent-access-token) |
| "Session expired, use a template" | More than 24 hours since the customer last wrote. Send an approved template |
| Template stuck in *Pending* | Meta is reviewing it, usually minutes to a few hours. Rejected? Edit the wording and resubmit |
| Broadcast shows many *Failed* | Numbers without a country code, people who don't use WhatsApp, or your daily messaging limit. Open the broadcast to see each reason |

## Automations and AI

| Problem | Fix |
|---|---|
| Automations with a *Wait* never continue | The scheduled jobs aren't running. See [Automations and cron](./automations-and-cron.md) |
| An automation didn't fire | Open its **Logs** tab: it shows every run and why a step was skipped |
| AI problems | See [AI troubleshooting](./ai-byok.md#troubleshooting) |

## Updating

| Problem | Fix |
|---|---|
| `almanac: command not found` | Open a new terminal window. Still missing? Run `node scripts/almanac.mjs install-cli` in the `almanac-crm` folder |
| "You've changed Almanac's files in this folder" | You edited files by hand. Run `git stash` in the folder, then `almanac update` |
| Almanac is down after an update | `almanac logs` shows why. `almanac restart` often fixes it; otherwise email us the log |
| No **Update now** button | Only the person who installed Almanac sees it, and only on installs started with `almanac start` |

Running the installer one-liner again also updates Almanac and keeps
your settings.

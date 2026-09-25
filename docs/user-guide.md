# Using Almanac

A tour of everything in the left-hand menu, in the order most businesses
start using it. Nothing here needs technical knowledge.

## Your first ten minutes

1. **Connect WhatsApp** in **Settings → WhatsApp** (see
   [WhatsApp setup](./whatsapp-setup.md)).
2. **Add your team**, if you have one: **Settings → Team members →
   Invite**. Share the link on WhatsApp; it works for 7 days by default.
3. **Save your most-typed answers** as quick replies: **Settings → Quick
   replies** (price list, address, UPI ID, delivery times).
4. **Import your customers**: **Contacts → Import**, from a CSV exported
   from your phone, Excel or Google Sheets. Every number needs its country
   code, e.g. `+919876543210`.
5. **Turn on a welcome message**: **Automations → New → Welcome message**.

## Inbox

Every WhatsApp chat lands here, newest first.

- **Reply** with text, photos, videos, documents or voice notes (the
  paperclip and microphone next to the message box).
- **Quick replies:** open **More** next to the message box and pick a
  saved answer. Anything you type can be saved as a quick reply from the
  same menu.
- **Assign** a chat to yourself or a teammate so two people never answer
  the same customer. **Close** it when it's done; it reopens by itself
  when the customer writes again.
- **Right-hand panel:** the customer's details, tags, private notes (the
  customer never sees them) and their deals.
- **Hover a message** to reply to it, react with an emoji, copy or delete.
- **The 24-hour clock** at the top of a chat shows how long you can still
  reply freely. After that, the box switches to **Send template**. See
  [the 24-hour window](./whatsapp-setup.md#rules-worth-knowing-before-you-message-customers).
- **✨ Draft with AI** writes a reply for you to edit, once AI is set up
  ([AI features](./ai-byok.md)).

Turn on **browser notifications** in **Settings → Your profile** so a
new message pings you even when the tab is in the background.

## Contacts

Everyone who has ever messaged you, plus anyone you add.

- **Add** one by hand or **Import** a CSV (name, phone, email, company,
  tags). Duplicates are detected by phone number.
- **Tags** group people: *Wholesale*, *Diwali 2026*, *Pune*. Broadcasts
  and automations use them.
- **Custom fields** hold anything else you track, like birthday, size or
  GST number. Create them in **Settings → Fields & tags**.
- Open a contact to see every conversation and deal with them.

## Pipelines

A board of deals, one column per stage. New pipelines start with *New
enquiry → Interested → Quote sent → Payment pending → Won*.

- **Add deal** from the top bar, from a column's **+**, or from a chat's
  right-hand panel so the deal stays linked to the conversation.
- **Drag** a card to move it to the next stage.
- Rename stages, change colours or add a *Lost* column from the gear
  icon. Run separate pipelines for, say, *Retail* and *Wholesale*.
- Amounts show in rupees by default. Change the currency in **Settings →
  Deals & currency**.

## Broadcasts

One message to many customers, personalised.

1. **New broadcast** → pick an approved **template**.
2. **Audience:** a tag, all contacts, or a CSV you upload.
3. **Personalise:** map `{{1}}`, `{{2}}` to contact fields (name, city)
   or type a fixed value.
4. **Send now** or schedule it.

The broadcast page shows sent, delivered, read and failed for every
recipient. Keep broadcasts to people who opted in, and don't send the
same offer twice in a day: reports from annoyed customers lower your
sending limits.

## Automations

"When this happens, do that", without code. Start from a template on
the **Automations** page or build your own.

**Triggers:** a new message, a customer's first-ever message, a keyword
(e.g. *price*, *kitna*), a button tap, a new contact, a chat being
assigned, a tag being added, or a schedule.

**Steps:** send a message, buttons, a list or a template; add or remove
a tag; assign the chat; update a contact field; create a deal; wait;
branch with if/else; call a webhook; close the chat.

Ideas that work well for small shops:

- **Welcome message** with buttons: *Price list*, *Location*, *Talk to us*.
- **After hours:** "We're closed, we'll reply at 9am" outside your hours.
- **Payment reminder:** tag *Payment pending* → wait 1 day → send your
  UPI details.
- **Review request:** deal moved to *Won* → wait 3 days → ask for a
  Google review.

Each automation has a **Logs** tab showing exactly what ran and why.
Automations with a **Wait** step need the scheduled jobs from the
installer's final checklist ([details](./automations-and-cron.md)).

## Flows (beta)

Chatbot menus: a customer taps buttons to check order status, browse a
catalogue or read FAQs, and is handed to you when they need a person.
Build them visually in **Flows**, test them, then turn them on.

## AI Agents

An assistant that drafts replies or answers simple questions by itself,
using your own OpenAI or Anthropic key. See [AI features](./ai-byok.md).

## Dashboard

Today's conversations, how fast you reply, what your pipeline is worth
and a live feed of what's happening. A good first screen each morning.

## Team and roles

**Settings → Team members.** Invite by link and choose a role:

| Role | Can |
|---|---|
| Owner | Everything, including transferring ownership of the account |
| Admin | Everything except transferring ownership |
| Agent | Chat, manage contacts and deals, run broadcasts |
| Viewer | Look, but not reply or change anything |

Working alone? You're the owner; there's nothing to set up.

## Settings at a glance

| Section | What it's for |
|---|---|
| Your profile | Name, photo, browser notifications |
| Login & security | Email, password, sign out everywhere |
| Appearance | Light or dark, accent colour |
| WhatsApp | Your number's connection |
| Templates | Create and sync Meta-approved templates |
| Quick replies | Saved answers |
| Fields & tags | Custom contact fields and tags |
| Deals & currency | Default currency |
| Team members | Invites and roles |
| API keys | Connect other tools ([Public API](./public-api.md)) |

## Updating Almanac

New features and fixes arrive regularly. Your data and settings are
always kept.

- **One click:** **Settings → Updates** shows what's new. Click **Update
  now**; Almanac is back in a couple of minutes. (Only the person who
  installed Almanac sees this button.)
- **From a terminal:** `almanac update`.
- **On Vercel:** **Sync fork** on GitHub, then Vercel redeploys.

## The `almanac` command

The installer adds a small command you can run from any terminal:

| Command | What it does |
|---|---|
| `almanac update` | Get the latest version and restart |
| `almanac status` | Is it running, which version, are updates waiting |
| `almanac start` / `stop` / `restart` | Run Almanac in the background, or stop it |
| `almanac logs` | Recent logs, handy when something's wrong |
| `almanac open` | Open Almanac in your browser |
| `almanac setup` | Change your keys and settings |
| `almanac autostart` | Start Almanac when the computer boots |

Almanac keeps running after you close the terminal window.

Stuck? [Troubleshooting](./troubleshooting.md), or email
[tuhin@almanac.bar](mailto:tuhin@almanac.bar).

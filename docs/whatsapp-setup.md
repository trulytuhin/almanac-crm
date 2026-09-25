# WhatsApp setup

Almanac talks to WhatsApp through Meta's official **WhatsApp Business
Platform** (the "Cloud API"). You set this up once in Meta's dashboards,
then paste five values into Almanac. Budget about 30 minutes.

## Before you start

- **A phone number for the business.** It must be able to receive an SMS
  or call once, for verification. A number that is currently on the
  WhatsApp or WhatsApp Business app has to be removed from the app first
  (Settings → Account → Delete account in the app), because a number
  connected to the API can't also be used in the phone app.
- **A Meta Business portfolio.** Create one at
  [business.facebook.com](https://business.facebook.com) if you don't
  have one. Use your real business name; you'll need it for verification.
- **Almanac installed** and reachable on a public `https://` address
  (see [Deploying](./deployment.md)). For a quick trial on your laptop,
  a tunnel works: `npx cloudflared tunnel --url http://localhost:3000`.

## 1. Create the Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
   and click **Create app**.
2. Choose the use case **Connect with customers through WhatsApp** (older
   screens: app type **Business**) and link your business portfolio.
3. In the app, open **App settings → Basic**. Copy the **App ID** and
   **App secret** (click **Show**). The installer asks for both.
4. Still on that page, add a **Privacy policy URL** (your own website's,
   or `https://almanac.bar/privacy` while you get started). Meta needs it
   before the app can go live.

## 2. Add your phone number

1. In the app, open **WhatsApp → API Setup**.
2. Meta gives you a free **test number** straight away. It can only
   message up to five phone numbers you verify on this page: good for a
   first test, not for customers.
3. Click **Add phone number**, enter your business display name and
   number, and verify it with the code Meta sends.
4. Copy two IDs from this page for your real number:
   - **Phone number ID**
   - **WhatsApp Business Account ID** (WABA ID)

> **Display name:** Meta reviews the name customers see. It should match
> your business (e.g. "Sharma Textiles"), not a personal name or a
> generic word. Approval usually takes a day or two; you can message in
> the meantime.

## 3. Create a permanent access token

The token on the API Setup page **expires after 24 hours**. Almanac
needs one that doesn't:

1. Open [Business settings](https://business.facebook.com/settings) →
   **Users → System users** → **Add**. Name it `almanac`, role **Admin**.
2. With the system user selected, click **Assign assets**:
   - **Apps** → your app → **Full control**
   - **WhatsApp accounts** → your account → **Full control**
3. Click **Generate new token**, pick your app, set expiry to **Never**,
   and tick these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copy the token now. Meta shows it only once.

> Treat this token like a password. Almanac stores it encrypted, and it
> never needs to go anywhere else.

## 4. Connect Almanac

1. In Almanac, open **Settings → WhatsApp**.
2. Fill in:
   - **Phone number ID** and **WABA ID** from step 2
   - **Access token** from step 3
   - **Verify token:** any random phrase you make up, e.g.
     `sharma-textiles-7Qx2`. You'll paste the same phrase into Meta next.
   - **Two-step verification PIN:** the 6-digit PIN for your number. If
     you never set one, choose one now in **WhatsApp Manager → Phone
     numbers → your number → Two-step verification**.
3. Click **Save**. Almanac checks the token, registers the number and
   links your WhatsApp account to the app. If something is wrong it says
   exactly which value to fix.

## 5. Point Meta's webhook at Almanac

This is how incoming messages reach your inbox.

1. In the Meta app, open **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL:** `https://<your Almanac address>/api/whatsapp/webhook`
   - **Verify token:** the same phrase you entered in Almanac
3. Click **Verify and save**, then under **Webhook fields** subscribe to:
   - `messages` (required: incoming messages and delivery ticks)
   - `message_template_status_update` (recommended: template approvals
     show up in Almanac automatically)
4. At the top of the app dashboard, switch **App mode** to **Live**.

Send a WhatsApp message to your business number from your own phone. It
appears in Almanac's **Inbox** within a second or two.

## Rules worth knowing before you message customers

- **The 24-hour window.** When a customer messages you, you can reply
  freely for 24 hours. Outside that window, or to message someone first,
  you must use a **template** Meta has approved. Almanac shows the
  window's status in each chat and offers templates when it has closed.
- **Templates.** Create them in **Settings → Templates** and submit them
  for approval, usually minutes to a few hours. Categories matter:
  *Utility* (order updates, reminders) is cheaper than *Marketing*
  (offers, festive greetings).
- **Opt-in.** Only message people who gave you their number and agreed
  to hear from you on WhatsApp. Customers can block or report you, and
  too many reports lower your number's quality rating and limits.
- **Messaging limits.** A new number can start conversations with a
  limited number of people per day (it starts around 250). The limit
  rises automatically as you send good-quality messages. Verifying your
  business in **Business settings → Security centre** raises it too.
- **Costs.** Meta bills per template message you send, by category and
  country. Replies inside the 24-hour window are free. Add a payment
  method in **WhatsApp Manager → Payment settings**. Current rates:
  [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing).

## If something goes wrong

Almanac explains most connection errors in plain words when you save
your settings. The full list, with fixes, is in
[WhatsApp connection troubleshooting](./whatsapp-connection-troubleshooting.md).
The most common three:

- **Messages don't arrive in the inbox:** the webhook isn't subscribed to
  `messages`, the app is still in Development mode, or the callback URL
  isn't reachable over `https`.
- **"Invalid OAuth access token":** you used the 24-hour token from API
  Setup. Create the permanent system user token (step 3).
- **"Registration failed" / PIN errors:** the two-step PIN doesn't match
  the one set on the number. Reset it in WhatsApp Manager.

Next: [Using Almanac](./user-guide.md).

# Automations and scheduled jobs

Most automations run the moment their trigger fires: a message arrives,
a keyword matches, a contact is created. Two things need a clock:

| Endpoint | What it does | How often |
|---|---|---|
| `GET /api/automations/cron` | Resumes automations paused on a **Wait** step once the wait is over | every 1–5 minutes |
| `GET /api/flows/cron` | Times out chatbot flows a customer abandoned, so they can start a new one | every 5–60 minutes |

Without the first, Wait steps never finish. Without the second, a
customer who walks away from a flow can't trigger another one.

## Set the secret

Both endpoints require the header `x-cron-secret` to match
`AUTOMATION_CRON_SECRET`. Generate one and add it to your environment:

```bash
openssl rand -hex 32
```

Until it's set, both endpoints answer `503 cron not configured`.

## Call them on a schedule

### crontab (VPS)

```cron
*/2 * * * * curl -fsS -H "x-cron-secret: $SECRET" https://crm.yourshop.in/api/automations/cron >/dev/null
*/10 * * * * curl -fsS -H "x-cron-secret: $SECRET" https://crm.yourshop.in/api/flows/cron >/dev/null
```

### cron-job.org (any host, free)

Create two jobs with the URLs above, add a request header
`x-cron-secret` with your secret, and set the intervals.

### GitHub Actions

Add `CRM_URL` and `AUTOMATION_CRON_SECRET` as repository secrets, then
create `.github/workflows/cron.yml`:

```yaml
name: Cron
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          for path in automations/cron flows/cron; do
            curl -fsS -H "x-cron-secret: ${{ secrets.AUTOMATION_CRON_SECRET }}" "${{ secrets.CRM_URL }}/api/$path"
          done
```

GitHub may delay scheduled runs by several minutes when it's busy, so
use crontab or cron-job.org if Wait steps need to be punctual.

## Starter automations

**Automations → New** offers four starting points, written for a small
shop that sells over WhatsApp:

- **Welcome message**: greets someone the first time they write.
- **Out of office**: replies outside 9am to 6pm so nobody waits in
  silence.
- **Lead qualifier**: when someone asks for a price, rate or quote (or
  writes "kitna"), asks what they want and how many, then assigns the
  chat.
- **Follow-up reminder**: nudges a customer who hasn't replied in a day.

Every one of them is editable. Change the text to sound like you.

# Changelog

Notable changes to Almanac.

## 2026-09-25: first release

### Install and update

- One-line install: `curl -fsSL https://almanac.bar/install.sh | bash` on
  macOS and Linux, `powershell -c "irm https://almanac.bar/install.ps1 | iex"`
  on Windows. A setup wizard asks for your Supabase and Meta keys,
  generates the secrets, creates the database and starts Almanac.
- The `almanac` command: `update`, `start`, `stop`, `status`, `logs`,
  `open`, `setup` and `autostart`. Almanac keeps running after the
  terminal closes.
- One-click updates in **Settings → Updates**, with guided "Sync fork"
  steps for Vercel installs.

### Made for small businesses in India

- Rupees by default, Indian digit grouping (₹1,23,456), and dashboards
  that count in lakh and crore.
- Pipelines start with *New enquiry, Interested, Quote sent, Payment
  pending, Won*.
- Starter automations for shops; the price-enquiry automation catches
  "price", "rate" and "kitna".
- AI replies on your own OpenAI or Anthropic key (BYOK).

### Look and feel

- The Almanac theme: deep green on paper, with a warm dark mode. Host
  Grotesk for the interface, Aleo for the wordmark.

### Guides and support

- A full user guide in `docs/` and at almanac.bar/guide: getting started,
  Supabase, WhatsApp and Meta tokens, going online, daily use, AI with
  your own key, automations and troubleshooting.
- Support at tuhin@almanac.bar.

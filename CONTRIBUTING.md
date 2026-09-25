# Contributing to Almanac

Thanks for helping. Almanac is built for small businesses and one-person
companies that run on WhatsApp, so the best contributions make that day
easier: fewer taps to reply, fewer missed follow-ups, clearer numbers.

## Run it locally

```bash
git clone https://github.com/trulytuhin/almanac-crm.git
cd almanac-crm
cp .env.local.example .env.local   # Supabase + Meta credentials
npm install
npm run dev
```

The full setup (migrations, WhatsApp, cron) is in
[docs/getting-started.md](./docs/getting-started.md). Set
`WHATSAPP_TEMPLATES_DRY_RUN=true` to work on templates without a real
WhatsApp account.

## Before you open a pull request

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | TypeScript, fast |
| `npm run lint` | ESLint (warnings are fine, errors are not) |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build |
| `npm run format` | Prettier |

CI runs the first four on every pull request, and a separate job replays
every migration against a clean Postgres when `supabase/` changes.

## Guidelines

- Branch off the latest `main`. One logical change per pull request.
- Open an issue first for anything bigger than a bug fix, so we can agree
  on the shape before you write it.
- The first line of a commit message is short and imperative. The body
  explains why.
- Database changes go in a new file under `supabase/migrations/`,
  numbered after the latest one.
- UI text lives in `messages/*.json`. Add new keys to every locale, even
  if the translation is English for now.
- Keep changes small and focused. Brand-only styling goes in
  `src/app/almanac.css`.

## Reporting bugs

Use the [bug report](https://github.com/trulytuhin/almanac-crm/issues/new?template=bug_report.yml)
template. The commit SHA, where it runs (local, Vercel, Docker, other)
and any logs get to a fix fastest.

Security issues go through [SECURITY.md](./.github/SECURITY.md), never a
public issue.

## License

By contributing you agree that your contribution is released under the
[MIT License](./LICENSE).

# Security policy

Almanac stores customer conversations and WhatsApp access tokens, so
security reports get priority over everything else.

## Reporting a vulnerability

**Please don't open a public issue for a security bug.** Report it
privately instead:

- [GitHub Security Advisories](https://github.com/trulytuhin/almanac-crm/security/advisories/new)
  (preferred, keeps the report, fix and advisory in one place), or
- email `tuhin@almanac.bar` with `[Almanac security]` in the subject.

Helpful to include:

- what the issue is and what an attacker could do with it,
- steps to reproduce or a proof of concept,
- the commit you tested against,
- whether and how you'd like to be credited.

## What to expect

- Acknowledgement within 72 hours.
- An initial assessment within a week.
- A fix and coordinated disclosure on a timeline that matches the
  severity. Critical issues are patched as soon as a fix is ready.

## Scope

In scope: everything in this repository, including webhook and auth
flows, token encryption, row-level security policies, the public API
and the cron endpoints, plus unsafe defaults in `docs/`.

Out of scope: bugs in Supabase, Next.js, Node.js or other dependencies
(report those to their maintainers), issues that need an already
compromised deployment such as a leaked service-role key, and social
engineering.

## Safe harbor

Good-faith research under this policy is welcome. We won't take legal
action against anyone who avoids data destruction and privacy
violations, gives us reasonable time before disclosure, and doesn't
exploit an issue beyond what's needed to show it.

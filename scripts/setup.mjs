#!/usr/bin/env node
// Almanac setup wizard. Run with `npm run setup` (the one-line installers
// call it for you). It:
//   1. asks for your Supabase and Meta keys and writes .env.local,
//      generating the encryption key and cron secret itself;
//   2. applies the database migrations to your Supabase project;
//   3. builds and starts Almanac.
//
// Safe to run again: it reads an existing .env.local and offers its
// values as defaults. Any value can also come from an environment
// variable of the same name, which skips that question.
//
// Flags: --skip-db (don't touch the database), --no-start (stop after
// setup), --yes (accept every default; fails if a required value is
// missing).

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const args = new Set(process.argv.slice(2));
const ASSUME_YES = args.has("--yes");
const ENV_FILE = ".env.local";
const TEMPLATE = ".env.local.example";
const SUPABASE_CLI = "supabase@2";

const c = (code) => (s) => (stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c("1");
const dim = c("2");
const green = c("32");
const red = c("31");

// A line queue rather than readline's question(): with piped input,
// readline reads ahead and lines arriving between questions are lost.
const rl = createInterface({ input: stdin, terminal: false });
const lines = [];
const waiting = [];
let closed = false;
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on("close", () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});
async function readAnswer(text) {
  stdout.write(text);
  const line = lines.length ? lines.shift() : closed ? null : await new Promise((resolve) => waiting.push(resolve));
  if (line === null) throw new Error("Input ended before setup finished. Run `npm run setup` again.");
  if (!stdin.isTTY) stdout.write("\n");
  return line;
}

function heading(text) {
  console.log(`\n${bold(green("▸"))} ${bold(text)}`);
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const PLACEHOLDER = /^(your-|https:\/\/your-project|https:\/\/crm\.example\.com|generate-)/;

async function ask(key, question, { current, fallback, required = true, check } = {}) {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const preset = current && !PLACEHOLDER.test(current) ? current : fallback;
  if (ASSUME_YES) {
    if (preset || !required) return preset ?? "";
    throw new Error(`${key} is required. Set it as an environment variable or run without --yes.`);
  }
  for (;;) {
    const hint = preset ? dim(` [${preset.length > 40 ? `${preset.slice(0, 12)}…` : preset}]`) : required ? "" : dim(" (optional, Enter to skip)");
    const answer = (await readAnswer(`  ${question}${hint}: `)).trim() || preset || "";
    if (!answer && !required) return "";
    const problem = !answer ? "This one is required." : check?.(answer);
    if (!problem) return answer;
    console.log(`  ${red(problem)}`);
  }
}

async function confirm(question, def = true) {
  if (ASSUME_YES) return def;
  const answer = (await readAnswer(`  ${question} ${dim(def ? "[Y/n]" : "[y/N]")} `)).trim().toLowerCase();
  return answer ? answer.startsWith("y") : def;
}

function run(cmd, cmdArgs, { quiet = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    stdio: quiet ? "ignore" : "inherit",
    shell: process.platform === "win32",
  });
  return res.status === 0;
}

const npx = (...a) => run("npx", ["--yes", SUPABASE_CLI, ...a]);

async function main() {
  // ---------------------------------------------------------------- 1. keys

  console.log(`\n${bold("Almanac setup")}  ${dim("Press Enter to keep a value shown in [brackets].")}`);

  const existing = readEnv(ENV_FILE);
  const values = {};

  heading("Supabase  (supabase.com → your project → Project Settings → API)");
  values.NEXT_PUBLIC_SUPABASE_URL = await ask("NEXT_PUBLIC_SUPABASE_URL", "Project URL", {
    current: existing.NEXT_PUBLIC_SUPABASE_URL,
    check: (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(v) || /^https?:\/\//.test(v) ? null : "Should look like https://abcd1234.supabase.co"),
  });
  values.NEXT_PUBLIC_SUPABASE_URL = values.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  values.NEXT_PUBLIC_SUPABASE_ANON_KEY = await ask("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon public key", {
    current: existing.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  values.SUPABASE_SERVICE_ROLE_KEY = await ask("SUPABASE_SERVICE_ROLE_KEY", "service_role secret key", {
    current: existing.SUPABASE_SERVICE_ROLE_KEY,
  });

  heading("WhatsApp  (developers.facebook.com → your app → App settings → Basic)");
  values.META_APP_SECRET = await ask("META_APP_SECRET", "App secret", { current: existing.META_APP_SECRET });
  values.META_APP_ID = await ask("META_APP_ID", "App ID", { current: existing.META_APP_ID, required: false });

  heading("This installation");
  values.NEXT_PUBLIC_SITE_URL = await ask("NEXT_PUBLIC_SITE_URL", "Public address people will open", {
    current: existing.NEXT_PUBLIC_SITE_URL,
    fallback: "http://localhost:3000",
    check: (v) => (/^https?:\/\/[^/]+$/.test(v.replace(/\/+$/, "")) ? null : "Scheme and host only, e.g. https://crm.yourshop.in"),
  });
  values.NEXT_PUBLIC_SITE_URL = values.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  values.NEXT_PUBLIC_APP_LOCALE = await ask("NEXT_PUBLIC_APP_LOCALE", "Language (en, pt, es, ko)", {
    current: existing.NEXT_PUBLIC_APP_LOCALE,
    fallback: "en",
    check: (v) => (["en", "pt", "es", "ko"].includes(v) ? null : "Pick en, pt, es or ko."),
  });

  // Secrets we generate. Keep existing ones: a new ENCRYPTION_KEY would
  // orphan every WhatsApp token already stored.
  const keep = (k) => existing[k] && !PLACEHOLDER.test(existing[k]);
  values.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (keep("ENCRYPTION_KEY") ? existing.ENCRYPTION_KEY : randomBytes(32).toString("hex"));
  values.AUTOMATION_CRON_SECRET =
    process.env.AUTOMATION_CRON_SECRET || (keep("AUTOMATION_CRON_SECRET") ? existing.AUTOMATION_CRON_SECRET : randomBytes(32).toString("hex"));

  // Write .env.local from the template so every comment stays in place.
  const base = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : readFileSync(TEMPLATE, "utf8");
  const seen = new Set();
  let env = base.replace(/^(?:# )?([A-Z0-9_]+)=.*$/gm, (line, key) => {
    if (!(key in values) || seen.has(key)) return line;
    seen.add(key);
    return values[key] === "" ? `# ${key}=` : `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key) && value !== "") env += `\n${key}=${value}\n`;
  }
  writeFileSync(ENV_FILE, env, { mode: 0o600 });
  console.log(`\n  ${green("✓")} Saved ${ENV_FILE} ${dim("(encryption key and cron secret generated for you)")}`);

  // ---------------------------------------------------------------- 2. database

  const ref = values.NEXT_PUBLIC_SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.(co|in)$/)?.[1];
  if (args.has("--skip-db")) {
    console.log(`  ${dim("Skipping the database (--skip-db).")}`);
  } else if (!ref) {
    console.log(`  ${dim("Not a hosted Supabase URL, so apply supabase/migrations yourself.")}`);
  } else if (await confirm("Set up the database now? (creates Almanac's tables in your Supabase project)")) {
    heading("Database");
    if (!process.env.SUPABASE_ACCESS_TOKEN && !run("npx", ["--yes", SUPABASE_CLI, "projects", "list"], { quiet: true })) {
      console.log(`  ${dim("Log in to Supabase once. A browser window opens, or paste an access token.")}`);
      if (!npx("login")) throw new Error("Supabase login failed.");
    }
    console.log(`  ${dim("Linking project")} ${ref}${dim(". You'll be asked for the database password you chose when creating it.")}`);
    if (!npx("link", "--project-ref", ref)) throw new Error("Could not link the Supabase project. Check the password and try `npm run setup` again.");
    if (!npx("db", "push", "--include-all")) throw new Error("Migrations failed. Fix the error above, then run `npm run setup` again.");
    console.log(`  ${green("✓")} Database ready`);
  }

  // ---------------------------------------------------------------- 3. start

  const next = [
    `Supabase → Authentication → URL Configuration: set Site URL to ${values.NEXT_PUBLIC_SITE_URL}`,
    `Meta → WhatsApp → Configuration: webhook URL ${values.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook, subscribe to "messages"`,
    "Almanac → Settings → WhatsApp: paste your Phone Number ID, WABA ID, access token and a verify token",
    `Scheduled jobs: call /api/automations/cron and /api/flows/cron with header x-cron-secret (value in ${ENV_FILE})`,
  ];
  console.log(`\n${bold("Almost there.")} When Almanac is running:`);
  next.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
  console.log(`  ${dim("Full guide: docs/getting-started.md")}`);

  // The `almanac` command: update, start, stop, status, logs.
  run("node", ["scripts/almanac.mjs", "install-cli"]);

  if (args.has("--no-start") || !(await confirm("Build and start Almanac now?"))) {
    console.log(`\n  Start it later with ${bold("almanac start")}\n`);
    process.exit(0);
  }
  rl.close();
  if (!run("node", ["scripts/almanac.mjs", "start", "--build"])) throw new Error("Almanac didn't start. Run `almanac logs` to see why.");
  console.log(`\n  ${bold("Useful commands")}  ${dim("(in a new terminal window)")}`);
  console.log("    almanac update    get the latest version");
  console.log("    almanac status    is it running, and are updates waiting?");
  console.log("    almanac stop      stop it");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n  ${red("✗")} ${err.message}\n`);
  process.exit(1);
});

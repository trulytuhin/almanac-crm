#!/usr/bin/env node
// The `almanac` command. The setup wizard installs it on your PATH, so
// from any terminal:
//
//   almanac update     get the latest Almanac and restart
//   almanac start      run Almanac in the background (keeps running after
//                      you close the terminal)
//   almanac stop | restart | status | logs | open | setup | autostart
//
// Background running uses pm2 (fetched with npx on first use). Settings →
// Updates in the app calls `almanac update` too.

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME_DIR = join(homedir(), ".almanac");
const LOCK = join(HOME_DIR, "updating");
const NAME = "almanac";
const PM2 = "pm2@5";
const SUPABASE_CLI = "supabase@2";
const WIN = platform() === "win32";

const tty = process.stdout.isTTY;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint("1");
const dim = paint("2");
const green = paint("32");
const red = paint("31");
const say = (s = "") => console.log(s);
const step = (s) => say(`\n${green("▸")} ${bold(s)}`);

class Failure extends Error {}
const fail = (message) => {
  throw new Failure(message);
};

function run(cmd, args, { quiet = false, capture = false, env } = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: capture ? ["ignore", "pipe", "pipe"] : quiet ? "ignore" : "inherit",
    shell: WIN,
    encoding: "utf8",
    env: env ?? process.env,
  });
  return { ok: res.status === 0, out: (res.stdout || "").trim() };
}

const git = (...args) => run("git", args, { capture: true });
const pm2 = (...args) => run("npx", ["--yes", PM2, ...args]);

function readEnv() {
  const file = join(ROOT, ".env.local");
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function siteUrl() {
  const env = readEnv();
  const port = process.env.PORT || "3000";
  return env.NEXT_PUBLIC_SITE_URL || `http://localhost:${port}`;
}

function isRunning() {
  const res = run("npx", ["--yes", PM2, "jlist"], { capture: true });
  if (!res.ok) return false;
  try {
    return JSON.parse(res.out.slice(res.out.indexOf("["))).some(
      (p) => p.name === NAME && p.pm2_env?.status === "online",
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- commands

function build() {
  step("Building (a minute or two)");
  if (!run("npm", ["run", "build"]).ok) fail("The build failed. See the error above.");
}

function start({ rebuild = false } = {}) {
  if (!existsSync(join(ROOT, ".env.local"))) fail("Almanac isn't set up yet. Run `almanac setup` first.");
  if (rebuild || !existsSync(join(ROOT, ".next", "BUILD_ID"))) build();
  const env = { ...process.env, ALMANAC_MANAGED: "1", ALMANAC_ROOT: ROOT, NODE_ENV: "production" };
  const port = process.env.PORT || "3000";
  step("Starting Almanac in the background");
  const ok = isRunning()
    ? run("npx", ["--yes", PM2, "restart", NAME, "--update-env"], { env }).ok
    : run(
        "npx",
        ["--yes", PM2, "start", join(ROOT, "node_modules", "next", "dist", "bin", "next"), "--name", NAME, "--cwd", ROOT, "--", "start", "-p", port],
        { env },
      ).ok;
  if (!ok) fail("Couldn't start Almanac. Try `almanac logs` to see why.");
  run("npx", ["--yes", PM2, "save"], { quiet: true });
  say(`\n  ${green("✓")} Almanac is running at ${bold(siteUrl())}`);
  say(`  ${dim("It keeps running after you close this window. `almanac stop` stops it.")}`);
}

function stop() {
  if (!isRunning()) return say("Almanac isn't running.");
  pm2("stop", NAME);
  say(`${green("✓")} Stopped.`);
}

function current() {
  return { commit: git("rev-parse", "HEAD").out, date: git("log", "-1", "--format=%cs").out };
}

function status() {
  const c = current();
  say(`${bold("Almanac")}  ${dim(`${c.commit.slice(0, 7)} · ${c.date}`)}`);
  say(`  Folder   ${ROOT}`);
  say(`  Address  ${siteUrl()}`);
  say(`  Running  ${isRunning() ? green("yes") : red("no") + dim("  (start it with `almanac start`)")}`);
  if (git("fetch", "--quiet", "origin", "main").ok) {
    const behind = Number(git("rev-list", "--count", "HEAD..origin/main").out || 0);
    say(`  Updates  ${behind ? bold(`${behind} available`) + dim("  (run `almanac update`)") : "up to date"}`);
  }
}

function update({ yes = false } = {}) {
  mkdirSync(HOME_DIR, { recursive: true });
  writeFileSync(LOCK, new Date().toISOString());
  try {
    step("Checking for updates");
    if (!git("fetch", "--quiet", "origin", "main").ok) fail("Couldn't reach GitHub. Check your internet connection.");
    const before = current().commit;
    const behind = Number(git("rev-list", "--count", "HEAD..origin/main").out || 0);
    if (!behind) {
      say(`  ${green("✓")} You're on the latest version.`);
      return;
    }
    say(`  ${behind} update(s):`);
    say(
      git("log", "--no-merges", "--format=  • %s", "HEAD..origin/main")
        .out.split("\n")
        .slice(0, 15)
        .join("\n"),
    );

    if (git("status", "--porcelain", "--untracked-files=no").out) {
      if (!yes) fail("You've changed Almanac's files in this folder. Commit or undo those changes, then run `almanac update` again.");
      git("stash", "push", "--message", `almanac update ${new Date().toISOString()}`);
      say(dim("  Your local changes were set aside with `git stash`."));
    }

    step("Downloading");
    if (!run("git", ["pull", "--ff-only", "origin", "main"]).ok) fail("Couldn't apply the update. Your copy may have its own commits.");

    step("Installing dependencies");
    if (!run("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"]).ok) fail("npm install failed. See the error above.");

    const changedDb = git("diff", "--name-only", `${before}..HEAD`, "--", "supabase/migrations").out;
    if (changedDb && existsSync(join(ROOT, "supabase", ".temp", "project-ref"))) {
      step("Updating the database");
      if (!run("npx", ["--yes", SUPABASE_CLI, "db", "push", "--include-all"]).ok) {
        fail("The database update failed. Fix the error above, then run `almanac update` again.");
      }
    } else if (changedDb) {
      say(dim("\n  This update changes the database. Apply supabase/migrations with `npx supabase db push`."));
    }

    build();
    if (isRunning()) {
      step("Restarting");
      pm2("restart", NAME, "--update-env");
    }
    say(`\n  ${green("✓")} Updated to ${current().commit.slice(0, 7)}.`);
  } finally {
    rmSync(LOCK, { force: true });
  }
}

// Put `almanac` on the PATH. Called by the setup wizard; safe to repeat.
function installCli() {
  const script = join(ROOT, "scripts", "almanac.mjs");
  if (WIN) {
    const bin = join(homedir(), ".almanac", "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "almanac.cmd"), `@echo off\r\nnode "${script}" %*\r\n`);
    const ps = `$p=[Environment]::GetEnvironmentVariable('Path','User'); if (-not ($p -split ';' -contains '${bin}')) { [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';${bin}'), 'User') }`;
    spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
  } else {
    const bin = join(homedir(), ".local", "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "almanac"), `#!/bin/sh\nexec node "${script}" "$@"\n`, { mode: 0o755 });
    if (!(process.env.PATH || "").split(":").includes(bin)) {
      const line = '\n# Added by Almanac\nexport PATH="$HOME/.local/bin:$PATH"\n';
      for (const rc of [".zshrc", ".bashrc", ".profile"]) {
        const file = join(homedir(), rc);
        const has = existsSync(file) && readFileSync(file, "utf8").includes("# Added by Almanac");
        if (!has && (existsSync(file) || rc === ".profile")) appendFileSync(file, line);
      }
    }
  }
  say(`  ${green("✓")} Added the ${bold("almanac")} command ${dim("(open a new terminal window to use it)")}`);
}

function autostart() {
  step("Starting Almanac automatically when this computer boots");
  if (!isRunning()) start();
  pm2("save");
  say(dim(WIN ? "  On Windows, add `almanac start` to Task Scheduler at log-on." : "  pm2 prints one command below. Copy and run it (it may ask for your password)."));
  if (!WIN) pm2("startup");
}

function openBrowser() {
  const url = siteUrl();
  const cmd = WIN ? "cmd" : platform() === "darwin" ? "open" : "xdg-open";
  const args = WIN ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  say(url);
}

function help() {
  say(`${bold("almanac")}  ${dim("your WhatsApp CRM, from the terminal")}

  ${bold("almanac update")}      Get the latest version and restart
  ${bold("almanac start")}       Run Almanac in the background
  ${bold("almanac stop")}        Stop it
  ${bold("almanac restart")}     Restart it
  ${bold("almanac status")}      Version, address, and whether updates are waiting
  ${bold("almanac logs")}        Show recent logs (Ctrl+C to exit)
  ${bold("almanac open")}        Open Almanac in your browser
  ${bold("almanac setup")}       Change your keys and settings
  ${bold("almanac autostart")}   Start Almanac when this computer boots

  Guide: https://almanac.bar/guide   Help: tuhin@almanac.bar`);
}

// ---------------------------------------------------------------- main

const [command = "help", ...rest] = process.argv.slice(2);
const flags = new Set(rest);

try {
  switch (command) {
    case "update":
      update({ yes: flags.has("--yes") });
      break;
    case "start":
      start({ rebuild: flags.has("--build") });
      break;
    case "stop":
      stop();
      break;
    case "restart":
      if (isRunning()) pm2("restart", NAME, "--update-env");
      else start();
      break;
    case "status":
      status();
      break;
    case "logs":
      pm2("logs", NAME, "--lines", "100");
      break;
    case "open":
      openBrowser();
      break;
    case "setup":
      run("node", [join(ROOT, "scripts", "setup.mjs"), ...rest]);
      break;
    case "autostart":
      autostart();
      break;
    case "install-cli":
      installCli();
      break;
    case "version":
    case "--version":
    case "-v": {
      const c = current();
      say(`${c.commit.slice(0, 7)} (${c.date})`);
      break;
    }
    default:
      help();
  }
} catch (err) {
  if (!(err instanceof Failure)) throw err;
  console.error(`\n  ${red("✗")} ${err.message}\n`);
  process.exit(1);
}

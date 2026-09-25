import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================
// Almanac updates: what version is running, what's newer, and
// (for installs managed by the `almanac` command) running the update.
//
// Three ways Almanac is hosted, three ways to update:
//   - managed:  installed with the one-liner and started with
//               `almanac start` (ALMANAC_MANAGED=1). The app can run
//               `almanac update` itself.
//   - vercel:   deployed from a GitHub fork. Updating = "Sync fork"
//               on GitHub; Vercel redeploys on its own.
//   - manual:   anything else (Docker, a hand-rolled server). We show
//               the command to run.
// ============================================================

export const ALMANAC_REPO = "trulytuhin/almanac-crm";
const ROOT = process.env.ALMANAC_ROOT || process.cwd();
const LOCK = join(homedir(), ".almanac", "updating");
const LOCK_MAX_AGE_MS = 30 * 60 * 1000;

export type Hosting = "managed" | "vercel" | "manual";

export interface UpdateCommit {
  sha: string;
  message: string;
  date: string | null;
}

export interface UpdateStatus {
  hosting: Hosting;
  current: { sha: string | null; date: string | null };
  latest: { sha: string; date: string | null } | null;
  /** Commits on the public main branch that this install doesn't have. */
  behindBy: number | null;
  commits: UpdateCommit[];
  updating: boolean;
  /** Vercel only: the GitHub repo this deployment builds from. */
  sourceRepo: string | null;
  checkFailed: boolean;
}

export function hosting(): Hosting {
  if (process.env.ALMANAC_MANAGED === "1") return "managed";
  if (process.env.VERCEL === "1") return "vercel";
  return "manual";
}

/** The commit this server was built from. */
export function currentCommit(): string | null {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    const gitDir = join(ROOT, ".git");
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return head;
    const ref = head.slice(5);
    const loose = join(gitDir, ref);
    if (existsSync(loose)) return readFileSync(loose, "utf8").trim();
    const packed = readFileSync(join(gitDir, "packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    return line ? line.split(" ")[0] : null;
  } catch {
    return null;
  }
}

export function isUpdating(): boolean {
  try {
    return Date.now() - statSync(LOCK).mtimeMs < LOCK_MAX_AGE_MS;
  } catch {
    return false;
  }
}

type GitHubCommit = { sha: string; commit: { message: string; committer?: { date?: string } } };

async function github<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${ALMANAC_REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "almanac-update-check" },
      // GitHub allows 60 unauthenticated calls an hour per IP; an hour
      // of caching keeps every install far below that.
      next: { revalidate: 3600 },
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const firstLine = (message: string) => message.split("\n")[0].trim();

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const sha = currentCommit();
  const base: UpdateStatus = {
    hosting: hosting(),
    current: { sha, date: null },
    latest: null,
    behindBy: null,
    commits: [],
    updating: isUpdating(),
    sourceRepo:
      process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
        ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
        : null,
    checkFailed: false,
  };

  const latest = await github<GitHubCommit>("/commits/main");
  if (!latest) return { ...base, checkFailed: true };
  base.latest = { sha: latest.sha, date: latest.commit.committer?.date ?? null };
  if (!sha) return base;
  if (sha === latest.sha) return { ...base, behindBy: 0, current: { sha, date: base.latest.date } };

  // A fork with its own commits can't be compared; say nothing rather
  // than guess.
  const compare = await github<{ ahead_by: number; commits: GitHubCommit[]; base_commit?: GitHubCommit }>(
    `/compare/${sha}...main`,
  );
  if (!compare) return base;
  return {
    ...base,
    current: { sha, date: compare.base_commit?.commit.committer?.date ?? null },
    behindBy: compare.ahead_by,
    commits: compare.commits
      .filter((c) => !firstLine(c.commit.message).startsWith("Merge "))
      .reverse()
      .slice(0, 30)
      .map((c) => ({ sha: c.sha, message: firstLine(c.commit.message), date: c.commit.committer?.date ?? null })),
  };
}

/** Start `almanac update` in the background. It rebuilds and restarts
 *  this server, so the caller should expect the app to blink. */
export function startUpdate(): void {
  const child = spawn(process.execPath, [join(ROOT, "scripts", "almanac.mjs"), "update", "--yes"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ALMANAC_ROOT: ROOT },
  });
  child.unref();
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";
import type { UpdateStatus } from "@/lib/almanac/updates";

type Status = UpdateStatus & { canUpdate: boolean };

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : "?");

/**
 * Settings → Updates. Shows what's new since this installation was
 * built and how to get it: one button for installs run by the
 * `almanac` command, "Sync fork" steps for Vercel, the command for
 * everything else.
 */
export function UpdatesPanel() {
  const t = useTranslations("Settings.updates");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const startSha = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/almanac/update", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Status;
      setStatus(data);
      setError(false);
      return data;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While an update runs the server rebuilds and restarts, so requests
  // fail for a while. Poll until it answers with a new commit.
  useEffect(() => {
    if (!updating) return;
    const timer = setInterval(async () => {
      const data = await load();
      if (data && !data.updating && data.current.sha !== startSha.current) {
        setUpdating(false);
        toast.success(t("done"));
        setTimeout(() => window.location.reload(), 1200);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [updating, load, t]);

  async function runUpdate() {
    startSha.current = status?.current.sha ?? null;
    const res = await fetch("/api/almanac/update", { method: "POST" });
    if (res.status === 202) {
      setUpdating(true);
      toast.message(t("started"));
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? t("failed"));
    }
  }

  const behind = status?.behindBy ?? 0;
  const upToDate = status && status.behindBy === 0;

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
        action={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || updating}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t("check")}
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-5 pt-6">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("checking")}
            </p>
          ) : error || !status ? (
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t("running")}</p>
                  <p className="font-mono text-sm text-foreground">{short(status.current.sha)}</p>
                </div>
                {updating || status.updating ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("inProgress")}
                  </span>
                ) : upToDate ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" /> {t("upToDate")}
                  </span>
                ) : behind > 0 ? (
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
                    {t("available", { count: behind })}
                  </span>
                ) : null}
              </div>

              {status.checkFailed ? <p className="text-sm text-muted-foreground">{t("checkFailed")}</p> : null}
              {!status.checkFailed && status.behindBy === null ? (
                <p className="text-sm text-muted-foreground">{t("cantCompare")}</p>
              ) : null}

              {behind > 0 && status.commits.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">{t("whatsNew")}</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {status.commits.map((c) => (
                      <li key={c.sha} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{c.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {behind > 0 || status.behindBy === null ? (
                <div className="rounded-lg border border-border bg-card-2 p-4 text-sm">
                  {status.hosting === "managed" ? (
                    status.canUpdate ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground">{t("managedHint")}</p>
                        <Button onClick={() => void runUpdate()} disabled={updating || status.updating}>
                          {updating || status.updating ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 h-4 w-4" />
                          )}
                          {t("updateNow")}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("askOwner")}</p>
                    )
                  ) : status.hosting === "vercel" ? (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{t("vercelTitle")}</p>
                      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                        <li>{t("vercelStep1")}</li>
                        <li>{t("vercelStep2")}</li>
                        <li>{t("vercelStep3")}</li>
                      </ol>
                      {status.sourceRepo ? (
                        <a
                          href={`https://github.com/${status.sourceRepo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1" })}
                        >
                          {t("openRepo")} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <Terminal className="h-4 w-4" /> {t("manualTitle")}
                      </p>
                      <code className="block rounded-md bg-muted px-3 py-2 font-mono text-foreground">almanac update</code>
                      <p className="text-muted-foreground">{t("manualHint")}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

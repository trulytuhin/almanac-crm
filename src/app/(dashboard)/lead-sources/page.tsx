'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Radio,
  KeyRound,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useCan } from '@/hooks/use-can';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LEAD_PROVIDERS, type LeadProvider } from '@/lib/leads/providers';
import { cn } from '@/lib/utils';

interface LeadSource {
  id: string;
  name: string;
  provider: LeadProvider;
  is_active: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  auto_reply_template_name: string | null;
  assign_to_profile_id: string | null;
  field_mapping: Record<string, string>;
  created_at: string;
}

interface Lead {
  id: string;
  lead_source_id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  deduped: boolean;
  reply_sent: boolean;
  created_at: string;
  // supabase types the joined row as an array; at runtime a many-to-one
  // join resolves to a single object.
  lead_sources:
    | { name: string; provider: string }
    | Array<{ name: string; provider: string }>
    | null;
}

function leadSourceName(lead: Lead): string {
  const s = lead.lead_sources;
  if (!s) return '—';
  return Array.isArray(s) ? (s[0]?.name ?? '—') : s.name;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
}

interface Template {
  name: string;
  language: string | null;
}

interface Member {
  id: string;
  full_name: string | null;
}

const PROVIDER_BADGE: Record<LeadProvider, string> = {
  indiamart: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  justdial: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  google_ads: 'bg-green-500/10 text-green-600 dark:text-green-400',
  meta: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  webhook: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

const LEAD_STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  qualified: 'bg-green-500/10 text-green-600 dark:text-green-400',
  invalid: 'bg-red-500/10 text-red-600 dark:text-red-400',
  duplicate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

interface FormState {
  name: string;
  provider: LeadProvider;
  pipelineId: string;
  stageId: string;
  templateName: string;
  assigneeId: string;
  verifySecret: string;
  fieldMapping: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  provider: 'webhook',
  pipelineId: '',
  stageId: '',
  templateName: '',
  assigneeId: '',
  verifySecret: '',
  fieldMapping: '{}',
  isActive: true,
};

export default function LeadSourcesPage() {
  const canManage = useCan('edit-settings');
  const t = useTranslations('LeadSources');
  const [sources, setSources] = useState<LeadSource[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LeadSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  // webhook key / URL shown exactly once after create or rotate
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [
        sourcesRes,
        leadsRes,
        pipelinesRes,
        stagesRes,
        templatesRes,
        membersRes,
      ] = await Promise.all([
        supabase
          .from('lead_sources')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select(
            'id, lead_source_id, name, phone, city, status, deduped, reply_sent, created_at, lead_sources(name, provider)'
          )
          .order('created_at', { ascending: false })
          .limit(25),
        supabase.from('pipelines').select('id, name').order('name'),
        supabase
          .from('pipeline_stages')
          .select('id, pipeline_id, name')
          .order('position'),
        supabase
          .from('message_templates')
          .select('name, language')
          .eq('status', 'Approved')
          .order('name'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ]);
      if (sourcesRes.error) throw sourcesRes.error;
      setSources((sourcesRes.data ?? []) as LeadSource[]);
      setLeads((leadsRes.data ?? []) as unknown as Lead[]);
      setPipelines((pipelinesRes.data ?? []) as Pipeline[]);
      setStages((stagesRes.data ?? []) as Stage[]);
      setTemplates((templatesRes.data ?? []) as Template[]);
      setMembers((membersRes.data ?? []) as Member[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stagesForPipeline = useMemo(
    () => stages.filter((s) => s.pipeline_id === form.pipelineId),
    [stages, form.pipelineId]
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setRevealedUrl(null);
    setDialogOpen(true);
  }

  function openEdit(source: LeadSource) {
    setEditing(source);
    setForm({
      name: source.name,
      provider: source.provider,
      pipelineId: source.default_pipeline_id ?? '',
      stageId: source.default_stage_id ?? '',
      templateName: source.auto_reply_template_name ?? '',
      assigneeId: source.assign_to_profile_id ?? '',
      verifySecret: '',
      fieldMapping: JSON.stringify(source.field_mapping ?? {}, null, 2),
      isActive: source.is_active,
    });
    setRevealedUrl(null);
    setDialogOpen(true);
  }

  function buildPayload() {
    let fieldMapping: Record<string, string> = {};
    try {
      const parsed = JSON.parse(form.fieldMapping || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        fieldMapping = parsed as Record<string, string>;
      }
    } catch {
      toast.error(t('toasts.badMapping'));
      return null;
    }
    return {
      name: form.name.trim(),
      provider: form.provider,
      is_active: form.isActive,
      default_pipeline_id: form.pipelineId || null,
      default_stage_id: form.stageId || null,
      auto_reply_template_name: form.templateName || null,
      assign_to_profile_id: form.assigneeId || null,
      // Empty = leave untouched on edit, absent on create.
      ...(form.verifySecret ? { verify_secret: form.verifySecret } : {}),
      field_mapping: fieldMapping,
    };
  }

  async function handleSave() {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const url = editing
        ? `/api/lead-sources/${editing.id}`
        : '/api/lead-sources';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? t('toasts.saveError'));
        return;
      }
      toast.success(editing ? t('toasts.updated') : t('toasts.created'));
      if (body.webhook_key) {
        setRevealedUrl(
          `${window.location.origin}/api/leads/ingest/${body.webhook_key}`
        );
      } else {
        setDialogOpen(false);
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(source: LeadSource, next: boolean) {
    setSources(
      (prev) =>
        prev?.map((s) =>
          s.id === source.id ? { ...s, is_active: next } : s
        ) ?? prev
    );
    const res = await fetch(`/api/lead-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: source.name,
        provider: source.provider,
        is_active: next,
        default_pipeline_id: source.default_pipeline_id,
        default_stage_id: source.default_stage_id,
        auto_reply_template_name: source.auto_reply_template_name,
        assign_to_profile_id: source.assign_to_profile_id,
        field_mapping: source.field_mapping ?? {},
      }),
    });
    if (!res.ok) {
      setSources(
        (prev) =>
          prev?.map((s) =>
            s.id === source.id ? { ...s, is_active: !next } : s
          ) ?? prev
      );
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? t('toasts.updateError'));
      return;
    }
    toast.success(next ? t('toasts.activated') : t('toasts.paused'));
  }

  async function rotateKey(source: LeadSource) {
    const res = await fetch(`/api/lead-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: source.name,
        provider: source.provider,
        is_active: source.is_active,
        default_pipeline_id: source.default_pipeline_id,
        default_stage_id: source.default_stage_id,
        auto_reply_template_name: source.auto_reply_template_name,
        assign_to_profile_id: source.assign_to_profile_id,
        field_mapping: source.field_mapping ?? {},
        rotate_key: true,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.webhook_key) {
      toast.error(body?.error ?? t('toasts.rotateError'));
      return;
    }
    setRevealedUrl(
      `${window.location.origin}/api/leads/ingest/${body.webhook_key}`
    );
    setDialogOpen(true);
    setEditing(source);
    toast.success(t('toasts.rotated'));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/lead-sources/${pendingDelete.id}`, {
      method: 'DELETE',
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? t('toasts.deleteError'));
      return;
    }
    toast.success(t('toasts.deleted'));
    setPendingDelete(null);
    load();
  }

  function copyRevealed() {
    if (!revealedUrl) return;
    navigator.clipboard.writeText(revealedUrl).then(
      () => {
        setCopied(true);
        toast.success(t('toasts.copied'));
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error(t('toasts.copyError'))
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (sources === null || leads === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <GatedButton
          canAct={canManage}
          gateReason="manage lead sources"
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('create')}
        </GatedButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            {t('sourcesTitle')}
          </CardTitle>
          <CardDescription>{t('sourcesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-foreground text-sm font-medium">
                {t('emptyTitle')}
              </p>
              <p className="text-muted-foreground max-w-md text-sm">
                {t('emptyDesc')}
              </p>
              <GatedButton
                canAct={canManage}
                gateReason="manage lead sources"
                onClick={openCreate}
                variant="outline"
                className="mt-2"
              >
                <Plus className="h-4 w-4" />
                {t('create')}
              </GatedButton>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colProvider')}</TableHead>
                  <TableHead>{t('colPipeline')}</TableHead>
                  <TableHead>{t('colAutoReply')}</TableHead>
                  <TableHead>{t('colActive')}</TableHead>
                  <TableHead className="text-right">
                    {t('colActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => {
                  const pipeline = pipelines.find(
                    (p) => p.id === source.default_pipeline_id
                  );
                  return (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">
                        {source.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'font-normal',
                            PROVIDER_BADGE[source.provider]
                          )}
                        >
                          {t(`providers.${source.provider}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {pipeline ? pipeline.name : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {source.auto_reply_template_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={source.is_active}
                          disabled={!canManage}
                          onCheckedChange={(next) => toggleActive(source, next)}
                          aria-label={t('colActive')}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canManage}
                            title={t('rotateKey')}
                            onClick={() => rotateKey(source)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canManage}
                            title={t('edit')}
                            onClick={() => openEdit(source)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canManage}
                            title={t('delete')}
                            onClick={() => setPendingDelete(source)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recentTitle')}</CardTitle>
          <CardDescription>{t('recentDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('leadsEmpty')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colTime')}</TableHead>
                  <TableHead>{t('colSource')}</TableHead>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colPhone')}</TableHead>
                  <TableHead>{t('colCity')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {leadSourceName(lead)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {lead.name ?? '—'}
                      {lead.reply_sent && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          ✓ {t('replied')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.phone ? `+${lead.phone}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lead.city ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'font-normal',
                          LEAD_STATUS_BADGE[lead.status] ?? ''
                        )}
                      >
                        {t(`statuses.${lead.status}`)}
                        {lead.deduped && lead.status !== 'duplicate'
                          ? ` · ${t('deduped')}`
                          : ''}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setRevealedUrl(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {revealedUrl ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('keyTitle')}</DialogTitle>
                <DialogDescription>{t('keyDescription')}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={revealedUrl}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyRevealed}
                  title={t('copy')}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    setRevealedUrl(null);
                  }}
                >
                  {t('done')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editing ? t('editTitle') : t('createTitle')}
                </DialogTitle>
                <DialogDescription>{t('formDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ls-name">{t('name')}</Label>
                  <Input
                    id="ls-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ls-provider">{t('provider')}</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(v) =>
                      setForm({ ...form, provider: v as LeadProvider })
                    }
                  >
                    <SelectTrigger id="ls-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {t(`providers.${p.value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ls-pipeline">{t('pipeline')}</Label>
                    <Select
                      value={form.pipelineId || 'none'}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          pipelineId: !v || v === 'none' ? '' : v,
                          stageId: '',
                        })
                      }
                    >
                      <SelectTrigger id="ls-pipeline">
                        <SelectValue placeholder={t('noPipeline')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('noPipeline')}</SelectItem>
                        {pipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ls-stage">{t('stage')}</Label>
                    <Select
                      value={form.stageId || 'none'}
                      disabled={!form.pipelineId}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          stageId: !v || v === 'none' ? '' : v,
                        })
                      }
                    >
                      <SelectTrigger id="ls-stage">
                        <SelectValue placeholder={t('noStage')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('noStage')}</SelectItem>
                        {stagesForPipeline.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ls-template">{t('template')}</Label>
                    <Select
                      value={form.templateName || 'none'}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          templateName: !v || v === 'none' ? '' : v,
                        })
                      }
                    >
                      <SelectTrigger id="ls-template">
                        <SelectValue placeholder={t('noTemplate')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('noTemplate')}</SelectItem>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.name} value={tpl.name}>
                            {tpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      {t.raw('templateHint')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ls-assignee">{t('assignee')}</Label>
                    <Select
                      value={form.assigneeId || 'none'}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          assigneeId: !v || v === 'none' ? '' : v,
                        })
                      }
                    >
                      <SelectTrigger id="ls-assignee">
                        <SelectValue placeholder={t('noAssignee')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('noAssignee')}</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name ?? m.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ls-secret">{t('verifySecret')}</Label>
                  <Input
                    id="ls-secret"
                    type="password"
                    value={form.verifySecret}
                    onChange={(e) =>
                      setForm({ ...form, verifySecret: e.target.value })
                    }
                    placeholder={
                      editing
                        ? t('verifySecretUnchanged')
                        : t('verifySecretPlaceholder')
                    }
                    autoComplete="new-password"
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('verifySecretHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ls-mapping">{t('fieldMapping')}</Label>
                  <Textarea
                    id="ls-mapping"
                    value={form.fieldMapping}
                    onChange={(e) =>
                      setForm({ ...form, fieldMapping: e.target.value })
                    }
                    className="font-mono text-xs"
                    rows={3}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('fieldMappingHint')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ls-active">{t('isActive')}</Label>
                  <Switch
                    id="ls-active"
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

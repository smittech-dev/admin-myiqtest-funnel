import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MailX,
  Plus,
  Play,
  Save,
  Send,
  Trash2,
  XCircle
} from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  fetchEmailMarketingConfig,
  fetchEmailMarketingLogs,
  runEmailMarketing,
  saveEmailMarketingConfig,
  sendTestEmail
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type {
  DiscountCodeOption,
  EmailMarketingLogItem,
  EmailMarketingLogStatus,
  EmailMarketingSettings,
  EmailMarketingStats,
  EmailMarketingStep,
  EmailTemplateOption,
  EmailTransportStatus
} from '@/types';

const LOG_PAGE_SIZE = 20;

/** Reads a delay back as something a person recognises. */
function describeDelay(hours: number): string {
  if (hours < 1) return Math.round(hours * 60) + ' min after the quiz';
  if (hours < 48) return hours + ' hours after the quiz';
  const days = hours / 24;
  return (Number.isInteger(days) ? days : days.toFixed(1)) + ' days after the quiz';
}

function statusBadge(status: EmailMarketingLogStatus) {
  switch (status) {
    case 'sent':
      return <Badge variant="success">Sent</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'skipped':
      return <Badge variant="muted">Skipped</Badge>;
    default:
      return <Badge variant="warning">Pending</Badge>;
  }
}

export function EmailMarketingPage() {
  // --- config ------------------------------------------------------------
  const [settings, setSettings] = useState<EmailMarketingSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [codes, setCodes] = useState<DiscountCodeOption[]>([]);
  const [transport, setTransport] = useState<EmailTransportStatus | null>(null);
  const [stats, setStats] = useState<EmailMarketingStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // `dirty` drives the save button. Tracked rather than deep-compared against
  // the loaded copy: the operator needs to know they have unsaved edits, and a
  // structural comparison of four steps every keystroke buys nothing.
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // --- activity ----------------------------------------------------------
  const [logs, setLogs] = useState<EmailMarketingLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logStatus, setLogStatus] = useState<EmailMarketingLogStatus | 'all'>('all');
  const [logStep, setLogStep] = useState('all');
  const [logTotal, setLogTotal] = useState(0);

  // --- actions -----------------------------------------------------------
  const [running, setRunning] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testTemplate, setTestTemplate] = useState('');
  const [testLanguage, setTestLanguage] = useState<'ja' | 'en'>('ja');
  const [testing, setTesting] = useState(false);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  const reloadLogs = useCallback(() => setLogsLoading(true), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchEmailMarketingConfig()
      .then((data) => {
        if (!active) return;
        setSettings(data.settings);
        setTemplates(data.templates);
        setCodes(data.discount_codes);
        setTransport(data.transport);
        setStats(data.stats);
        setDirty(false);
        setTestTemplate((current) => current || data.templates[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setLogsLoading(true);

    fetchEmailMarketingLogs({
      status: logStatus,
      stepKey: logStep,
      page: 1,
      pageSize: LOG_PAGE_SIZE
    })
      .then((result) => {
        if (!active) return;
        setLogs(result.items);
        setLogTotal(result.total);
      })
      .catch(() => {
        if (!active) return;
        setLogs([]);
        setLogTotal(0);
      })
      .finally(() => {
        if (active) setLogsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logStatus, logStep, reloadKey]);

  const updateSettings = useCallback((patch: Partial<EmailMarketingSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setNotice(null);
  }, []);

// A step runs the discount ladder, so only marketing designs belong in its
  // picker. The test-send box below deliberately offers everything.
  const marketingTemplates = useMemo(
    () => templates.filter((t) => t.category === 'marketing'),
    [templates]
  );

  /**
   * A key for a brand-new step.
   *
   * Generated from the clock rather than the row count because a key is
   * permanent — every log row the step ever writes references it — so reusing
   * `step_5` after deleting the fifth step would silently adopt the deleted
   * step's send history, and nobody would be emailed that rung again.
   */
  const nextStepKey = useCallback((existing: EmailMarketingStep[]) => {
    let candidate = 'step_' + Date.now().toString(36);
    let suffix = 1;
    while (existing.some((s) => s.key === candidate)) {
      candidate = 'step_' + Date.now().toString(36) + '_' + suffix++;
    }
    return candidate;
  }, []);

  const addStep = useCallback(() => {
    setSettings((current) => {
      if (!current) return current;

      const lastDelay = current.steps.reduce((max, s) => Math.max(max, s.delay_hours), 0);

      return {
        ...current,
        steps: [
          ...current.steps,
          {
            key: nextStepKey(current.steps),
            label: 'New step',
            // Off, and a day past the last rung. A new step that arrived
            // enabled would start emailing whoever already qualifies for it the
            // moment it was saved.
            enabled: false,
            delay_hours: lastDelay + 24,
            discount_code: '',
            template_id: marketingTemplates[0]?.id ?? ''
          }
        ]
      };
    });
    setDirty(true);
    setNotice(null);
  }, [nextStepKey, marketingTemplates]);

  const removeStep = useCallback((key: string) => {
    setSettings((current) =>
      current ? { ...current, steps: current.steps.filter((s) => s.key !== key) } : current
    );
    setDirty(true);
    setNotice(null);
  }, []);

  const updateStep = useCallback((key: string, patch: Partial<EmailMarketingStep>) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step) => (step.key === key ? { ...step, ...patch } : step))
          }
        : current
    );
    setDirty(true);
    setNotice(null);
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setNotice(null);

    try {
      const { settings: saved } = await saveEmailMarketingConfig(settings);
      setSettings(saved);
      setDirty(false);
      setNotice({ kind: 'ok', text: 'Settings saved. The next run picks them up.' });
    } catch (err: unknown) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not save the settings'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    setNotice(null);

    try {
      const result = await runEmailMarketing();
      setNotice({
        kind: 'ok',
        text:
          'Run finished: ' +
          result.sent +
          ' sent, ' +
          result.failed +
          ' failed, ' +
          result.superseded +
          ' superseded, from ' +
          result.candidates +
          ' candidate(s).'
      });
      retry();
    } catch (err: unknown) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'The run failed' });
    } finally {
      setRunning(false);
    }
  }

  async function handleTestSend() {
    if (!testTo.trim() || !testTemplate) return;
    setTesting(true);
    setNotice(null);

    try {
      const result = await sendTestEmail({
        templateId: testTemplate,
        to: testTo,
        language: testLanguage,
        // The step's own code is not implied here — the test previews a design,
        // and a design is used by more than one step.
        discountCode: codes.find((c) => c.discount === 20)?.code ?? codes[0]?.code
      });
      setNotice({ kind: 'ok', text: 'Test sent to ' + testTo + ' — "' + result.subject + '"' });
    } catch (err: unknown) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not send the test email'
      });
    } finally {
      setTesting(false);
    }
  }

  const stepOptions = useMemo(
    () => settings?.steps.map((s) => ({ key: s.key, label: s.label })) ?? [],
    [settings]
  );


  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-4">
      {/* --- delivery status ------------------------------------------- */}
      {transport && !loading && <TransportBanner transport={transport} settings={settings} />}

      {notice && (
        <div
          className={
            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm ' +
            (notice.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-destructive/40 bg-destructive/10 text-destructive')
          }
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* --- the sequence ----------------------------------------------- */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Abandoned checkout sequence</CardTitle>
            <CardDescription>
              Sent to people whose email verified, who took the quiz, and never completed the
              first sale. Each person receives any given step at most once.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings?.enabled ?? false}
                onCheckedChange={(v) => updateSettings({ enabled: v })}
                disabled={loading || !settings}
                aria-label="Enable the sequence"
              />
              <span className="text-sm font-medium">
                {settings?.enabled ? 'Sending' : 'Paused'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRun} disabled={running || loading}>
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run now
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving || loading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading && <Skeleton className="h-64 w-full" />}

          {!loading && settings && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-0">On</TableHead>
                      <TableHead className="min-w-[180px]">Step</TableHead>
                      <TableHead className="w-[150px]">Send after</TableHead>
                      <TableHead className="w-[190px]">Discount code</TableHead>
                      <TableHead className="min-w-[230px]">Email template</TableHead>
                      <TableHead className="w-[110px] text-right">Sent</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.steps.map((step) => {
                      const template = templates.find((t) => t.id === step.template_id);
                      const stepStats = stats?.by_step[step.key];
                      // The server's rule, sent with the template: a design with
                      // no copy for going out without a discount needs a code.
                      const needsDiscount = template?.requires_discount ?? false;

                      return (
                        <TableRow key={step.key}>
                          <TableCell>
                            <Switch
                              checked={step.enabled}
                              onCheckedChange={(v) => updateStep(step.key, { enabled: v })}
                              aria-label={'Enable ' + step.label}
                            />
                          </TableCell>

                          <TableCell>
                            <Input
                              value={step.label}
                              onChange={(e) => updateStep(step.key, { label: e.target.value })}
                              className="h-9"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">{step.key}</p>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0.01}
                                step={1}
                                value={step.delay_hours}
                                onChange={(e) =>
                                  updateStep(step.key, {
                                    delay_hours: Number(e.target.value) || 0
                                  })
                                }
                                className="h-9 w-20 tabular-nums"
                              />
                              <span className="text-muted-foreground text-xs">hours</span>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {describeDelay(step.delay_hours)}
                            </p>
                          </TableCell>

                          <TableCell>
                            <Select
                              value={step.discount_code || 'none'}
                              onValueChange={(v) =>
                                updateStep(step.key, { discount_code: v === 'none' ? '' : v })
                              }
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" disabled={needsDiscount}>
                                  No discount
                                </SelectItem>
                                {codes.map((code) => (
                                  <SelectItem key={code.code} value={code.code}>
                                    {code.discount}% — {code.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {needsDiscount && step.enabled && !step.discount_code && (
                              <p className="text-destructive mt-1 text-xs">
                                This template shows the discount — pick a code
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            <Select
                              value={step.template_id}
                              onValueChange={(v) => updateStep(step.key, { template_id: v })}
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {marketingTemplates.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {template?.hosted_in_zeptomail && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Rendered by ZeptoMail
                              </p>
                            )}
                          </TableCell>

                          <TableCell className="text-right tabular-nums">
                            {stepStats?.sent ?? 0}
                            {stepStats?.failed ? (
                              <span className="text-destructive"> / {stepStats.failed} failed</span>
                            ) : null}
                          </TableCell>

                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              // The last step cannot go: the sequence needs at
                              // least one rung, and the save would be rejected.
                              disabled={settings.steps.length <= 1}
                              onClick={() => removeStep(step.key)}
                              aria-label={'Remove ' + step.label}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="size-4" />
                  Add step
                </Button>
                {/* Deleting a step removes the rung, not the record of what it
                    already sent — worth saying, because the counts in the table
                    above are the only hint that history exists at all. */}
                <p className="text-muted-foreground text-xs">
                  Removing a step keeps its send history. Sending order follows the delay, not the
                  row order.
                </p>
              </div>

              {/* --- guard rails -------------------------------------- */}
              <div className="grid gap-4 border-t pt-5 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="batch-size">Emails per run</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    min={1}
                    max={500}
                    value={settings.batch_size}
                    onChange={(e) =>
                      updateSettings({ batch_size: Number(e.target.value) || 1 })
                    }
                    className="tabular-nums"
                  />
                  <p className="text-muted-foreground text-xs">
                    Caps how much a single run can send.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max-age">Ignore quizzes older than</Label>
                  <Input
                    id="max-age"
                    type="number"
                    min={1}
                    value={settings.max_age_hours}
                    onChange={(e) =>
                      updateSettings({ max_age_hours: Number(e.target.value) || 1 })
                    }
                    className="tabular-nums"
                  />
                  <p className="text-muted-foreground text-xs">
                    Hours. Stops turning the sequence on from emailing your whole back catalogue.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max-attempts">Retries per step</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.max_attempts}
                    onChange={(e) =>
                      updateSettings({ max_attempts: Number(e.target.value) || 1 })
                    }
                    className="tabular-nums"
                  />
                  <p className="text-muted-foreground text-xs">
                    How often a failed send is retried before the step is given up on.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* --- test send --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Send a test</CardTitle>
          <CardDescription>
            Delivers any template — marketing or transactional — to your own inbox with sample
            data. It records no history, so nobody loses their place in the sequence and no
            customer's credentials are touched.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="test-to">Recipient</Label>
              <Input
                id="test-to"
                type="email"
                placeholder="you@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>

            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label>Template</Label>
              <Select value={testTemplate} onValueChange={setTestTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.category === 'transactional' ? '✉ ' : '◷ '}
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select
                value={testLanguage}
                onValueChange={(v) => setTestLanguage(v as 'ja' | 'en')}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">Japanese (JA)</SelectItem>
                  <SelectItem value="en">English (EN)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleTestSend} disabled={testing || !testTo.trim() || !testTemplate}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* --- activity ---------------------------------------------------- */}
      <Card className="gap-0 pb-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              The last {LOG_PAGE_SIZE} of {logTotal.toLocaleString()} tracked sends.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={logStep} onValueChange={setLogStep}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All steps</SelectItem>
                {stepOptions.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={logStatus}
              onValueChange={(v) => setLogStatus(v as EmailMarketingLogStatus | 'all')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={reloadLogs} disabled={logsLoading}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full min-w-10" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!logsLoading &&
                logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {row.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.step_key}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.template_name}</TableCell>
                    <TableCell className="text-muted-foreground uppercase">
                      {row.discount_code ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {statusBadge(row.status)}
                        {/* The reason matters more than the status for anything
                            that did not send — show it inline rather than
                            behind a detail view this page does not need. */}
                        {(row.error_message || row.skip_reason) && (
                          <span className="text-muted-foreground max-w-[240px] truncate text-xs">
                            {row.error_message ?? row.skip_reason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.sent_at ?? row.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {!logsLoading && logs.length === 0 && (
            <EmptyState
              icon={MailX}
              title="Nothing sent yet"
              description="Marketing emails will appear here as the sequence runs."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The "will this actually send?" banner.
 *
 * Three separate things have to be true — credentials present, transport on,
 * sequence on — and an operator who has flipped one of them should not have to
 * guess which of the other two is still holding it back.
 */
function TransportBanner({
  transport,
  settings
}: {
  transport: EmailTransportStatus;
  settings: EmailMarketingSettings | null;
}) {
  const problems: string[] = [];

  if (!transport.configured && transport.problem) problems.push(transport.problem);
  if (!transport.enabled) problems.push('Email sending is off (ZEPTOMAIL_ENABLED=false).');
  if (!transport.cron_enabled)
    problems.push('The schedule is not registered (EMAIL_MARKETING_ENABLED=false).');
  if (settings && !settings.enabled) problems.push('The sequence is paused here in the panel.');

  if (problems.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          Live — sending as <strong>{transport.from_name}</strong> &lt;{transport.from_address}&gt;,
          checked every <code>{transport.cron_expression}</code> ({transport.cron_timezone}).
        </span>
        {transport.dry_run && <Badge variant="warning">Dry run: nothing is delivered</Badge>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4 shrink-0" />
        No marketing email will be delivered right now
      </div>
      <ul className="mt-1 ml-6 list-disc space-y-0.5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileWarning, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  SubscriptionStatusBadge,
  TransactionStatusBadge
} from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { fetchQuizDetail } from '@/lib/api';
import { ApiError } from '@/lib/http';
import { currencyOf, formatDateTime, formatDuration, formatMoney, titleCase } from '@/lib/format';
import type { QuizSubmissionDetail } from '@/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className="text-sm break-words">{children ?? '—'}</div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="text-muted-foreground tabular-nums">{score}</span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: score + '%' }} />
      </div>
    </div>
  );
}

export function QuizDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<QuizSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // 404 means the id is wrong; anything else is a failure worth retrying.
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setError(null);

    fetchQuizDetail(id)
      .then((result) => {
        if (!active) return;
        setDetail(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setDetail(null);
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={retry} />
        </CardContent>
      </Card>
    );
  }

  if (notFound || !detail) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={FileWarning}
            title="Submission not found"
            description={'No quiz submission exists with ID #' + id + '.'}
          />
          <div className="flex justify-center pb-4">
            <Button asChild variant="outline">
              <Link to="/quiz">Back to submissions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { quiz, customer, transactions, subscriptions } = detail;
  const currency = currencyOf(quiz.language);
  const revenue = transactions
    .filter((t) => t.status === 'succeeded')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/quiz">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Quiz #{quiz.id}</h2>
            <p className="text-muted-foreground text-sm">
              Submitted {formatDateTime(quiz.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">
            {quiz.language} / {quiz.country_code}
          </Badge>
          <Badge variant="secondary">
            Revenue {formatMoney(revenue, currency)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quiz Result</CardTitle>
            <CardDescription>Score, timing, and attribution for this attempt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="IQ Score">
                <span className="text-2xl font-semibold tabular-nums">{quiz.iq_score ?? '—'}</span>
              </Field>
              <Field label="Duration">{formatDuration(quiz.duration_seconds)}</Field>
              <Field label="Age">{quiz.age}</Field>
              <Field label="Gender">{quiz.gender ? titleCase(quiz.gender) : '—'}</Field>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-sm font-medium">Category Scores</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(quiz.category_scores ?? {}).map(([key, score]) => (
                  <ScoreBar key={key} label={key} score={score} />
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="UTM Source">{quiz.landing_url_details?.utm_source}</Field>
              <Field label="UTM Medium">{quiz.landing_url_details?.utm_medium}</Field>
              <Field label="Campaign">{quiz.landing_url_details?.utm_campaign}</Field>
              <Field label="Landing Page">{quiz.landing_url_details?.landing_page}</Field>
            </div>

            {quiz.report_urls && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(quiz.report_urls).map(([key, url]) => (
                    <Button key={key} asChild variant="outline" size="sm">
                      <a href={url} target="_blank" rel="noreferrer">
                        {titleCase(key)}
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
            <CardDescription>Account linked to this submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Name">
              {quiz.last_name} {quiz.first_name}
            </Field>
            <Field label="Email">
              <div className="flex items-center gap-2">
                <span className="truncate">{quiz.email}</span>
                {customer?.email_verified ? (
                  <Badge variant="success">Verified</Badge>
                ) : (
                  <Badge variant="muted">Unverified</Badge>
                )}
              </div>
            </Field>
            <Field label="Customer ID">
              {customer ? '#' + customer.id : 'No account created'}
            </Field>
            <Field label="Account Status">
              {customer ? <Badge variant="outline">{titleCase(customer.status)}</Badge> : '—'}
            </Field>
            <Field label="Stripe Customer">
              <code className="text-xs">{customer?.stripe_customer_id ?? '—'}</code>
            </Field>
            <Separator />
            <Field label="IP Address">
              <code className="text-xs">{quiz.ip_address}</code>
            </Field>
            <Field label="Payment Method">
              <code className="text-xs">{quiz.stripe_payment_method_id ?? '—'}</code>
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Transactions</CardTitle>
          <CardDescription>All payment attempts tied to this quiz result.</CardDescription>
        </CardHeader>
        <CardContent className="border-t px-0">
          {transactions.length === 0 ? (
            <EmptyState icon={FileWarning} title="No transactions" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GBP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Intent</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-medium">{titleCase(txn.transaction_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(txn.amount, txn.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {formatMoney(txn.amount_gbp, 'GBP')}
                    </TableCell>
                    <TableCell>
                      <TransactionStatusBadge status={txn.status} />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{txn.stripe_payment_intent_id ?? '—'}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{txn.stripe_charge_id ?? '—'}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(txn.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <CardDescription>Recurring plans started from this quiz result.</CardDescription>
        </CardHeader>
        <CardContent className="border-t px-0">
          {subscriptions.length === 0 ? (
            <EmptyState icon={FileWarning} title="No subscription" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Period</TableHead>
                  <TableHead>Stripe Subscription</TableHead>
                  <TableHead>Canceled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.plan_name ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(sub.amount, sub.currency)}
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(sub.current_period_start)} &rarr;{' '}
                      {formatDateTime(sub.current_period_end)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{sub.stripe_subscription_id}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.canceled_at
                        ? formatDateTime(sub.canceled_at) +
                          (sub.cancel_reason ? ' (' + titleCase(sub.cancel_reason) + ')' : '')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

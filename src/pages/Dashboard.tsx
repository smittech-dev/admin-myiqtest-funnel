import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, FileText, Inbox, Layers, Repeat } from 'lucide-react';
import { DateRangePicker, type DateRangeValue } from '@/components/common/DateRangePicker';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatCard } from '@/components/common/StatCard';
import { SubscriptionStatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { fetchDashboardStats, fetchQuizSubmissions } from '@/lib/api';
import { currencyOf, formatDateTime, formatMoney } from '@/lib/format';
import type { DashboardStats, QuizSubmissionListItem } from '@/types';

export function DashboardPage() {
  const [range, setRange] = useState<DateRangeValue>({});
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<QuizSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchDashboardStats(range),
      fetchQuizSubmissions({ ...range, page: 1, pageSize: 6 })
    ])
      .then(([nextStats, list]) => {
        if (!active) return;
        setStats(nextStats);
        setRecent(list.items);
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
  }, [range, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-muted-foreground text-sm">
            Funnel performance for the selected period.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error ? (
        <Card>
          <CardContent>
            <ErrorState message={error} onRetry={retry} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Quiz Submitted"
              value={stats?.total_quiz_submitted ?? 0}
              icon={FileText}
              accent="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              loading={loading}
            />
            <StatCard
              label="Total First Sale"
              value={stats?.total_first_sale ?? 0}
              icon={CreditCard}
              accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              loading={loading}
            />
            <StatCard
              label="Total Cross Sell"
              value={stats?.total_cross_sale ?? 0}
              icon={Layers}
              accent="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              loading={loading}
            />
            <StatCard
              label="Active Subscriptions"
              value={stats?.total_active_subscription ?? 0}
              icon={Repeat}
              accent="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              loading={loading}
            />
          </div>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Recent Submissions</CardTitle>
              <CardDescription>Latest quiz results in the selected period.</CardDescription>
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button asChild variant="outline" size="sm">
                  <Link to="/quiz">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="border-t px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IQ</TableHead>
                    <TableHead>Purchases</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((__, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full min-w-10" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : recent.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link
                              to={'/quiz/' + row.id}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              #{row.id}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">{row.email}</TableCell>
                          <TableCell className="tabular-nums">{row.iq_score ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {row.has_first_sale && <Badge variant="success">First</Badge>}
                              {row.has_cross_sale && <Badge variant="info">Cross</Badge>}
                              {!row.has_first_sale && !row.has_cross_sale && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <SubscriptionStatusBadge status={row.subscription_status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.revenue, currencyOf(row.language))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(row.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>

              {!loading && recent.length === 0 && (
                <EmptyState
                  icon={Inbox}
                  title="No submissions in this period"
                  description="Widen the date range to see earlier quiz results."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

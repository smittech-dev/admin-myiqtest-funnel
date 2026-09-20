import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SearchX } from 'lucide-react';
import { DateRangePicker, type DateRangeValue } from '@/components/common/DateRangePicker';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { fetchQuizSubmissions, type QuizListParams } from '@/lib/api';
import { currencyOf, formatDateTime, formatMoney } from '@/lib/format';
import type { QuizSubmissionListItem } from '@/types';

const PAGE_SIZE = 10;

type StatusFilter = NonNullable<QuizListParams['status']>;
type LanguageFilter = NonNullable<QuizListParams['language']>;

export function QuizListPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [language, setLanguage] = useState<LanguageFilter>('all');
  const [range, setRange] = useState<DateRangeValue>({});
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<QuizSubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  // The API reports total_pages, so the UI does not recompute it.
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // Debounce keeps the list from refetching on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change puts the user back on the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, language, range.from, range.to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchQuizSubmissions({
      search: debouncedSearch,
      status,
      language,
      from: range.from,
      to: range.to,
      page,
      pageSize: PAGE_SIZE
    })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, status, language, range.from, range.to, page, reloadKey]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return 'No results';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return 'Showing ' + start + '–' + end + ' of ' + total;
  }, [page, total]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by quiz ID, result link ID, or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All submissions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All submissions</SelectItem>
            <SelectItem value="first_sale">First sale</SelectItem>
            <SelectItem value="cross_sale">Cross sell</SelectItem>
            <SelectItem value="subscription">Active subscription</SelectItem>
            <SelectItem value="no_purchase">No purchase</SelectItem>
          </SelectContent>
        </Select>

        <Select value={language} onValueChange={(v) => setLanguage(v as LanguageFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="ja">Japanese (JA)</SelectItem>
            <SelectItem value="en">English (EN)</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          {error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>IQ</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>First Sale</TableHead>
                <TableHead>Cross Sell</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full min-w-10" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!loading &&
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">#{row.id}</TableCell>
                    <TableCell>
                      <div className="max-w-[220px]">
                        <p className="truncate font-medium">
                          {row.last_name} {row.first_name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{row.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.iq_score ?? '—'}</TableCell>
                    <TableCell className="uppercase">{row.language}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.landing_url_details?.utm_source ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.has_first_sale ? (
                        <Badge variant="success" className="tabular-nums">
                          {formatMoney(row.first_sale_amount, currencyOf(row.language))}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.has_cross_sale ? (
                        <Badge variant="info" className="tabular-nums">
                          {formatMoney(row.cross_sale_amount, currencyOf(row.language))}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={'/quiz/' + row.id}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          )}

          {!error && !loading && items.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="No submissions found"
              description="Try a different quiz ID, a result link ID, an email, or widen the date range."
            />
          )}
        </CardContent>
      </Card>

      {!error && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{rangeLabel}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

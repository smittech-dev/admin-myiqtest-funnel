import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  MailOpen,
  Search,
  Trash2,
  TriangleAlert
} from 'lucide-react';
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
import {
  deleteContactInquiry,
  fetchContactInquiries,
  setContactInquiryStatus,
  type ContactListParams
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { ContactInquiry, ContactTopic } from '@/types';

const PAGE_SIZE = 20;

type StatusFilter = NonNullable<ContactListParams['status']>;
type TopicFilter = NonNullable<ContactListParams['topic']>;

/** The funnel's topic keys, in the language an operator reads. */
const TOPIC_LABELS: Record<ContactTopic, string> = {
  billing: 'Billing or refunds',
  results: 'Results',
  technical: 'Something is broken',
  press: 'Press or partnerships',
  other: 'Something else'
};

export function ContactInquiriesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [range, setRange] = useState<DateRangeValue>({});
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ContactInquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /** The message shown in the reading pane, by id. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // Debounce keeps the list from refetching on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change puts the user back on the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, topic, range.from, range.to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchContactInquiries({
      search: debouncedSearch,
      status,
      topic,
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
        setUnread(result.unread);
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
  }, [debouncedSearch, status, topic, range.from, range.to, page, reloadKey]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const rangeLabel = useMemo(() => {
    if (total === 0) return 'No inquiries';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return 'Showing ' + start + '–' + end + ' of ' + total;
  }, [page, total]);

  /**
   * Opening a message marks it read.
   *
   * Optimistically, and without blocking the read: the pane is already showing
   * the message, so a failed PATCH means the badge is wrong until the next
   * load, which is not worth an error in the operator's way.
   */
  const open = useCallback(
    (inquiry: ContactInquiry) => {
      setSelectedId(inquiry.id);
      setActionError(null);

      if (inquiry.status === 'read') return;

      setItems((current) =>
        current.map((item) => (item.id === inquiry.id ? { ...item, status: 'read' } : item))
      );
      setUnread((count) => Math.max(0, count - 1));

      void setContactInquiryStatus(inquiry.id, 'read').catch(() => {
        // Put it back, so the list still reflects the server.
        setItems((current) =>
          current.map((item) => (item.id === inquiry.id ? { ...item, status: 'new' } : item))
        );
        setUnread((count) => count + 1);
      });
    },
    []
  );

  const markUnread = useCallback(async (inquiry: ContactInquiry) => {
    setBusyId(inquiry.id);
    setActionError(null);
    try {
      await setContactInquiryStatus(inquiry.id, 'new');
      setItems((current) =>
        current.map((item) => (item.id === inquiry.id ? { ...item, status: 'new' } : item))
      );
      setUnread((count) => count + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not update this inquiry');
    } finally {
      setBusyId(null);
    }
  }, []);

  const remove = useCallback(
    async (inquiry: ContactInquiry) => {
      // Permanent, and there is no archive to restore from — so it is worth one
      // question, even in an admin tool.
      if (!window.confirm(`Delete the inquiry from ${inquiry.email}? This cannot be undone.`)) {
        return;
      }

      setBusyId(inquiry.id);
      setActionError(null);
      try {
        await deleteContactInquiry(inquiry.id);
        setSelectedId(null);
        // Refetch rather than splice: the page is now one row short, and the
        // row that fills it lives on the server.
        retry();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Could not delete this inquiry');
      } finally {
        setBusyId(null);
      }
    },
    [retry]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, email, or words in the message…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All inquiries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All inquiries</SelectItem>
            <SelectItem value="new">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        <Select value={topic} onValueChange={(v) => setTopic(v as TopicFilter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {(Object.keys(TOPIC_LABELS) as ContactTopic[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TOPIC_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {unread > 0 && (
        <p className="text-muted-foreground text-sm">
          <Badge variant="info" className="mr-2 tabular-nums">
            {unread}
          </Badge>
          unread {unread === 1 ? 'inquiry' : 'inquiries'} in total.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="gap-0 py-0">
          <CardContent className="px-0">
            {error ? (
              <ErrorState message={error} onRetry={retry} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full min-w-10" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {!loading &&
                    items.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.id === selectedId ? 'selected' : undefined}
                        className="cursor-pointer"
                        onClick={() => open(row)}
                      >
                        <TableCell>
                          <div className="flex max-w-[260px] items-start gap-2">
                            {row.status === 'new' ? (
                              <Mail className="text-primary mt-0.5 size-4 shrink-0" />
                            ) : (
                              <MailOpen className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={
                                  'truncate ' +
                                  (row.status === 'new' ? 'font-semibold' : 'font-medium')
                                }
                              >
                                {row.name}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">{row.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {TOPIC_LABELS[row.topic] ?? row.topic}
                        </TableCell>
                        <TableCell className="uppercase">{row.language}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                        <TableCell>
                          {/* The notification failed, but the message is here —
                              worth saying, because an operator who relies on
                              their inbox would otherwise never know. */}
                          {row.notify_error && !row.notified_at && (
                            <span
                              title={'Admin notification not sent — ' + row.notify_error}
                              className="text-amber-600 dark:text-amber-400"
                            >
                              <TriangleAlert className="size-4" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}

            {!error && !loading && items.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="No inquiries found"
                description="Nothing matches these filters. Try a different search, or widen the date range."
              />
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardContent>
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{selected.name}</p>
                    <a
                      href={'mailto:' + selected.email}
                      className="text-primary text-sm break-all underline-offset-4 hover:underline"
                    >
                      {selected.email}
                    </a>
                  </div>
                  <Badge variant={selected.status === 'new' ? 'info' : 'muted'}>
                    {selected.status === 'new' ? 'Unread' : 'Read'}
                  </Badge>
                </div>

                <dl className="text-sm">
                  <div className="flex justify-between gap-4 py-1">
                    <dt className="text-muted-foreground">Topic</dt>
                    <dd className="text-right">
                      {TOPIC_LABELS[selected.topic] ?? selected.topic}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-1">
                    <dt className="text-muted-foreground">Reply in</dt>
                    <dd className="text-right uppercase">{selected.language}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-1">
                    <dt className="text-muted-foreground">Received</dt>
                    <dd className="text-right">{formatDateTime(selected.created_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-1">
                    <dt className="text-muted-foreground">Notified</dt>
                    <dd className="text-right">
                      {selected.notified_at ? formatDateTime(selected.notified_at) : 'Not sent'}
                    </dd>
                  </div>
                  {selected.ip_address && (
                    <div className="flex justify-between gap-4 py-1">
                      <dt className="text-muted-foreground">IP</dt>
                      <dd className="text-right tabular-nums">{selected.ip_address}</dd>
                    </div>
                  )}
                </dl>

                {selected.notify_error && (
                  <p className="rounded-md bg-amber-100 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    The admin notification did not go out: {selected.notify_error}
                  </p>
                )}

                {/* The visitor's own words, wrapped as they typed them. */}
                <p className="bg-muted/50 rounded-md px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </p>

                {actionError && <p className="text-destructive text-sm">{actionError}</p>}

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href={'mailto:' + selected.email}>Reply</a>
                  </Button>
                  {selected.status === 'read' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === selected.id}
                      onClick={() => void markUnread(selected)}
                    >
                      <Mail className="size-4" />
                      Mark unread
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === selected.id}
                    onClick={() => void remove(selected)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Inbox}
                title="Nothing selected"
                description="Pick an inquiry from the list to read it here."
              />
            )}
          </CardContent>
        </Card>
      </div>

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

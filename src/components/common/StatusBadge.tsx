import { Badge } from '@/components/ui/badge';
import { formatDate, titleCase } from '@/lib/format';
import type { SubscriptionStatus, TransactionStatus } from '@/types';

const TRANSACTION_VARIANT: Record<TransactionStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  succeeded: 'success',
  pending: 'warning',
  failed: 'destructive',
  refunded: 'muted'
};

const SUBSCRIPTION_VARIANT: Record<
  SubscriptionStatus,
  'success' | 'info' | 'warning' | 'destructive' | 'muted'
> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  unpaid: 'destructive',
  paused: 'muted',
  incomplete: 'destructive',
  incomplete_expired: 'muted',
  canceled: 'muted'
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge variant={TRANSACTION_VARIANT[status]}>{titleCase(status)}</Badge>;
}

/**
 * Stripe's status, plus the scheduled end when there is one.
 *
 * A cancelled plan stays `trialing` or `active` at Stripe until it actually
 * ends, so the status on its own reads as "renewing". `cancelAt` is what says
 * otherwise, and it is shown the way Stripe's own Dashboard shows it.
 */
export function SubscriptionStatusBadge({
  status,
  cancelAt
}: {
  status: SubscriptionStatus | null;
  cancelAt?: string | null;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;

  const badge = (
    <Badge variant={SUBSCRIPTION_VARIANT[status] ?? 'muted'}>{titleCase(status)}</Badge>
  );

  if (!cancelAt) return badge;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {badge}
      <Badge variant="outline" title="Cancellation scheduled — the plan will not renew">
        Cancels {formatDate(cancelAt)}
      </Badge>
    </div>
  );
}

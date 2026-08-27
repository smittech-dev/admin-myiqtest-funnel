import { Badge } from '@/components/ui/badge';
import { titleCase } from '@/lib/format';
import type { SubscriptionStatus, TransactionStatus } from '@/types';

const TRANSACTION_VARIANT: Record<TransactionStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  succeeded: 'success',
  pending: 'warning',
  failed: 'destructive',
  refunded: 'muted'
};

const SUBSCRIPTION_VARIANT: Record<SubscriptionStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  active: 'success',
  past_due: 'warning',
  canceled: 'muted',
  incomplete: 'destructive'
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge variant={TRANSACTION_VARIANT[status]}>{titleCase(status)}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={SUBSCRIPTION_VARIANT[status]}>{titleCase(status)}</Badge>;
}

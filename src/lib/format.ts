import { format, parseISO } from 'date-fns';
import type { Currency, Language } from '@/types';

/** The funnel prices in JPY for Japanese traffic and GBP for English. */
export function currencyOf(language: Language): Currency {
  return language === 'ja' ? 'JPY' : 'GBP';
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'dd MMM yyyy, HH:mm');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'dd MMM yyyy');
}

export function formatMoney(amount: string | number | null, currency: Currency = 'JPY'): string {
  if (amount === null || amount === undefined) return '—';
  const value = Number(amount);
  return new Intl.NumberFormat(currency === 'JPY' ? 'ja-JP' : 'en-GB', {
    style: 'currency',
    currency,
    // JPY has no minor unit; GBP keeps its two decimals.
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm ' + String(s).padStart(2, '0') + 's';
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

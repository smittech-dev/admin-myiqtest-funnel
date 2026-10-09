// Mirrors the /admin responses from new-funnel-backend. Field names are the
// backend's (snake_case) so responses need no translation on arrival.

export type TransactionType = 'first_sale' | 'cross_sale' | 'subscription' | 'refund';
export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';
export type Currency = 'JPY' | 'GBP';
export type Language = 'ja' | 'en';

/** Signed-in admin, from POST /admin/auth/login and GET /admin/auth/me. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface LoginResult {
  token: string;
  token_type: string;
  expires_in: number;
  user: AdminUser;
}

/** Customer account as the admin API exposes it — never the password hash. */
export interface Customer {
  id: string;
  email: string;
  email_verified: boolean;
  status: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  customer_quiz_result_id: string;
  customer_id: string | null;
  transaction_type: TransactionType;
  amount: string;
  currency: Currency;
  amount_gbp: string | null;
  status: TransactionStatus;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refunded_at: string | null;
  refund_amount: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  customer_quiz_result_id: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  plan_name: string | null;
  amount: string;
  currency: Currency;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

/**
 * One row of GET /admin/quiz-submissions. The list endpoint deliberately omits
 * the heavy quiz fields (category scores, report urls, ip) — those arrive with
 * the detail call.
 */
export interface QuizSubmissionListItem {
  id: string;
  customer_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  age: string | null;
  gender: string | null;
  iq_score: number | null;
  duration_seconds: number | null;
  language: Language;
  country_code: string;
  landing_url_details: Record<string, string> | null;
  created_at: string;
  revenue: string;
  has_first_sale: boolean;
  has_cross_sale: boolean;
  first_sale_amount: string | null;
  cross_sale_amount: string | null;
  subscription_status: SubscriptionStatus | null;
}

/** The full customer_quiz_results row, from the detail endpoint. */
export interface QuizSubmission {
  id: string;
  customer_id: string | null;
  email: string;
  stripe_payment_method_id: string | null;
  first_name: string | null;
  last_name: string | null;
  age: string | null;
  gender: string | null;
  iq_score: number | null;
  category_scores: Record<string, number> | null;
  duration_seconds: number | null;
  language: Language;
  ip_address: string | null;
  country_code: string;
  landing_url_details: Record<string, string> | null;
  report_urls: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

/** GET /admin/quiz-submissions/:id */
export interface QuizSubmissionDetail {
  quiz: QuizSubmission;
  customer: Customer | null;
  transactions: PaymentTransaction[];
  subscriptions: Subscription[];
}

/** GET /admin/dashboard/stats */
export interface DashboardStats {
  total_quiz_submitted: number;
  total_first_sale: number;
  total_cross_sale: number;
  total_active_subscription: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

// --- email marketing -----------------------------------------------------
// Mirrors /admin/email-marketing/*. The sequence is a ladder of "steps": each
// one fires a chosen template, carrying a chosen discount code, a chosen number
// of hours after the customer submitted their quiz.

export type EmailMarketingLogStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface EmailMarketingStep {
  /** Permanent id — every log row ever written references it. */
  key: string;
  label: string;
  enabled: boolean;
  delay_hours: number;
  /** A code from the funnel's discount list; empty means no discount. */
  discount_code: string;
  template_id: string;
}

export interface EmailMarketingSettings {
  enabled: boolean;
  batch_size: number;
  max_attempts: number;
  max_age_hours: number;
  steps: EmailMarketingStep[];
}

export type EmailTemplateCategory = 'marketing' | 'transactional';

/** One entry of the template master, as the picker needs it. */
export interface EmailTemplateOption {
  id: string;
  name: string;
  description: string;
  /** Marketing designs run the ladder; transactional ones follow a purchase. */
  category: EmailTemplateCategory;
  params: string[];
  subject: { ja: string; en: string };
  /** The subject sent when the step has no discount code. */
  subject_without_discount: { ja: string; en: string };
  /** True when ZeptoMail renders the design, not this repo. */
  hosted_in_zeptomail: boolean;
  /** True when a step using this design cannot be saved with "No discount". */
  requires_discount: boolean;
}

export interface DiscountCodeOption {
  code: string;
  discount: number;
}

export interface EmailTransportStatus {
  enabled: boolean;
  configured: boolean;
  problem: string | null;
  from_address: string;
  from_name: string;
  dry_run: boolean;
  cron_enabled: boolean;
  cron_expression: string;
  cron_timezone: string;
}

export interface EmailMarketingStatusCounts {
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface EmailMarketingStats {
  totals: EmailMarketingStatusCounts;
  by_step: Record<string, EmailMarketingStatusCounts>;
}

/** GET /admin/email-marketing/config — settings plus everything to edit them. */
export interface EmailMarketingConfigResponse {
  settings: EmailMarketingSettings;
  templates: EmailTemplateOption[];
  discount_codes: DiscountCodeOption[];
  transport: EmailTransportStatus;
  stats: EmailMarketingStats;
}

export interface EmailMarketingLogItem {
  id: string;
  customer_id: string;
  customer_quiz_result_id: string | null;
  email: string;
  step_key: string;
  template_id: string;
  template_name: string;
  discount_code: string | null;
  language: Language;
  status: EmailMarketingLogStatus;
  provider_message_id: string | null;
  error_message: string | null;
  skip_reason: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
}

/** POST /admin/email-marketing/run */
export interface EmailMarketingRunResult {
  candidates: number;
  sent: number;
  failed: number;
  superseded: number;
  nothing_due: number;
  duration_ms: number;
}

// --- contact inquiries ---------------------------------------------------

export type ContactTopic = 'billing' | 'results' | 'technical' | 'press' | 'other';
export type ContactStatus = 'new' | 'read';

/** One submission of the funnel's contact form. */
export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  language: Language;
  status: ContactStatus;
  ip_address: string | null;
  /** When the admin notification left. Null means it never did. */
  notified_at: string | null;
  /** Why it did not, when it did not. */
  notify_error: string | null;
  created_at: string;
}

/**
 * A page of inquiries, plus the unread count.
 *
 * `unread` is counted across the whole table rather than through the current
 * filter, so the number means the same thing on every view.
 */
export interface ContactInquiryList extends PaginatedResult<ContactInquiry> {
  unread: number;
}

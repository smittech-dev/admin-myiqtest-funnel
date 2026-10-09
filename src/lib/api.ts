// One function per admin endpoint. Pages call these and nothing else.

import { clearToken, request, setToken } from '@/lib/http';
import type {
  AdminUser,
  ContactInquiry,
  ContactInquiryList,
  ContactStatus,
  ContactTopic,
  DashboardStats,
  EmailMarketingConfigResponse,
  EmailMarketingLogItem,
  EmailMarketingLogStatus,
  EmailMarketingRunResult,
  EmailMarketingSettings,
  LoginResult,
  PaginatedResult,
  QuizSubmissionDetail,
  QuizSubmissionListItem
} from '@/types';

export interface DateRangeParams {
  from?: Date;
  to?: Date;
}

export type QuizStatusFilter =
  | 'all'
  | 'first_sale'
  | 'cross_sale'
  | 'subscription'
  | 'no_purchase';

export interface QuizListParams extends DateRangeParams {
  search?: string;
  status?: QuizStatusFilter;
  language?: 'all' | 'ja' | 'en';
  page?: number;
  pageSize?: number;
}

/**
 * Sends the range as full ISO instants, exactly as picked.
 *
 * Deliberately *not* widened to day boundaries here any more: the picker now
 * carries a time, and forcing start/end of day would quietly throw it away —
 * an operator who asked for 09:00–12:00 would get the whole day and no
 * indication why. Whole-day ranges still work because the picker defaults the
 * times to 00:00 and 23:59.
 *
 * The instant is the operator's local one, so "Today" means today where they
 * are rather than in UTC. The backend accepts either form.
 */
function rangeQuery(params: DateRangeParams): Record<string, string | undefined> {
  return {
    from: params.from ? params.from.toISOString() : undefined,
    to: params.to ? params.to.toISOString() : undefined
  };
}

// --- auth ----------------------------------------------------------------

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await request<LoginResult>('/admin/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    // A failed sign-in is the user's problem to see, not a session to tear down.
    skipAuthRedirect: true
  });
  setToken(result.token);
  return result;
}

/** Validates a stored token and returns who it belongs to. */
export async function fetchCurrentAdmin(): Promise<AdminUser> {
  return request<AdminUser>('/admin/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await request<null>('/admin/auth/logout', { method: 'POST' });
  } catch {
    // Signing out must always succeed locally, even if the call fails.
  } finally {
    clearToken();
  }
}

// --- dashboard -----------------------------------------------------------

export async function fetchDashboardStats(
  params: DateRangeParams = {}
): Promise<DashboardStats> {
  return request<DashboardStats>('/admin/dashboard/stats', {
    query: rangeQuery(params)
  });
}

// --- quiz ----------------------------------------------------------------

export async function fetchQuizSubmissions(
  params: QuizListParams = {}
): Promise<PaginatedResult<QuizSubmissionListItem>> {
  const { search, status = 'all', language = 'all', page = 1, pageSize = 10 } = params;

  return request<PaginatedResult<QuizSubmissionListItem>>('/admin/quiz-submissions', {
    query: {
      ...rangeQuery(params),
      search: search?.trim() || undefined,
      status,
      language,
      page,
      page_size: pageSize
    }
  });
}

export async function fetchQuizDetail(id: string): Promise<QuizSubmissionDetail> {
  return request<QuizSubmissionDetail>(`/admin/quiz-submissions/${encodeURIComponent(id)}`);
}

// --- email marketing -----------------------------------------------------

export async function fetchEmailMarketingConfig(): Promise<EmailMarketingConfigResponse> {
  return request<EmailMarketingConfigResponse>('/admin/email-marketing/config');
}

/**
 * Saves the whole settings object, not a patch. The backend validates it as a
 * unit — a step's delay only makes sense against the other steps' delays — so
 * there is nothing sensible to send a field at a time.
 */
export async function saveEmailMarketingConfig(
  settings: EmailMarketingSettings
): Promise<{ settings: EmailMarketingSettings }> {
  return request<{ settings: EmailMarketingSettings }>('/admin/email-marketing/config', {
    method: 'PUT',
    body: settings
  });
}

export interface EmailMarketingLogParams extends DateRangeParams {
  stepKey?: string;
  status?: EmailMarketingLogStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchEmailMarketingLogs(
  params: EmailMarketingLogParams = {}
): Promise<PaginatedResult<EmailMarketingLogItem>> {
  const { stepKey = 'all', status = 'all', search, page = 1, pageSize = 20 } = params;

  return request<PaginatedResult<EmailMarketingLogItem>>('/admin/email-marketing/logs', {
    query: {
      ...rangeQuery(params),
      step_key: stepKey,
      status,
      search: search?.trim() || undefined,
      page,
      page_size: pageSize
    }
  });
}

/** Runs the same pass as the five-minute cron, immediately. */
export async function runEmailMarketing(): Promise<EmailMarketingRunResult> {
  return request<EmailMarketingRunResult>('/admin/email-marketing/run', { method: 'POST' });
}

/**
 * Sends one saved step — its template, with its discount code — to an address
 * with a sample customer. Records no send history.
 */
export async function sendTestEmail(input: {
  stepKey: string;
  to: string;
  language: 'ja' | 'en';
}): Promise<{ subject: string; message_id: string | null }> {
  return request<{ subject: string; message_id: string | null }>(
    '/admin/email-marketing/test-send',
    {
      method: 'POST',
      body: {
        step_key: input.stepKey,
        to: input.to.trim(),
        language: input.language
      }
    }
  );
}

// --- contact inquiries ---------------------------------------------------

export interface ContactListParams extends DateRangeParams {
  /** Matched against the name, the address and the message body. */
  search?: string;
  status?: ContactStatus | 'all';
  topic?: ContactTopic | 'all';
  page?: number;
  pageSize?: number;
}

export async function fetchContactInquiries(
  params: ContactListParams = {}
): Promise<ContactInquiryList> {
  const { search, status = 'all', topic = 'all', page = 1, pageSize = 20 } = params;

  return request<ContactInquiryList>('/admin/contact-inquiries', {
    query: {
      ...rangeQuery(params),
      search: search?.trim() || undefined,
      status,
      topic,
      page,
      page_size: pageSize
    }
  });
}

/** Marks one inquiry opened or unopened. The only field that can change. */
export async function setContactInquiryStatus(
  id: string,
  status: ContactStatus
): Promise<ContactInquiry> {
  return request<ContactInquiry>(`/admin/contact-inquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status }
  });
}

/** Permanent — for clearing out spam. */
export async function deleteContactInquiry(id: string): Promise<void> {
  await request<null>(`/admin/contact-inquiries/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

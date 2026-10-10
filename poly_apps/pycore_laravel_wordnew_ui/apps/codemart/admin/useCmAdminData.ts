import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { CM_ADMIN_ROUTE, cmRouteWithQuery } from '../components/public-home/cmPublicRoutes';
import {
  cmFormatDate,
  cmFormatDateTime,
  cmFormatMoney,
  cmFormatNumber,
  cmFormatTime,
} from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList, type CmPagedSlice } from '../components/workspace/useCmPagedList';
import { cmAdminApi } from './CmAdminApi';
import type {
  CmAdminKycDocument,
  CmAdminKycRecord,
  CmAdminOverviewData,
  CmAdminPage,
  CmAdminPolicy,
  CmAdminQuery,
} from './CmAdminTypes';

type CmAdminFetcher<T> = (query: CmAdminQuery) => Promise<APIResponse<CmAdminPage<T>>>;

function extractAdminPage<T>(data: CmAdminPage<T>): CmPagedSlice<T> {
  return { items: data.items, totalPages: data.total_pages, total: data.total };
}

/** Locale-aware money, number and date formatting for the console. */
export function useCmAdminFormat() {
  const { i18n } = useTranslation('cm');
  const language = i18n.language || 'en';
  const defaultCurrency = useCmPolicy().currency;

  return useMemo(() => {
    const money = (amount: string | number, currency?: string | null): string => cmFormatMoney(amount, currency || defaultCurrency, language);
    const number = (value: number, maxFractionDigits?: number): string => cmFormatNumber(value, language, maxFractionDigits);
    const date = (value: string, withTime: boolean, calendar = false): string => (
      withTime ? cmFormatDateTime(value, language) : cmFormatDate(value, language, calendar)
    );
    const time = (value: string): string => cmFormatTime(value, language);
    return { language, money, number, date, time };
  }, [defaultCurrency, language]);
}

/** Admin list on the shared paged-list hook: the filters feed each request and a filter change restarts at page 1. */
export function useCmAdminList<T>(fetcher: CmAdminFetcher<T>, filters: CmAdminQuery): CmPagedList<T> {
  const filterKey = JSON.stringify(filters);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fetchPage = useCallback(
    (page: number) => fetcherRef.current({ ...(JSON.parse(filterKey) as CmAdminQuery), page }),
    [filterKey],
  );
  return useCmPagedList(fetchPage, extractAdminPage<T>, 'admin.loadFailed');
}

/** Initial filter value taken from the query string (used by overview counter links). */
export function useCmAdminParam(key: string, fallback = ''): string {
  const [searchParams] = useSearchParams();
  return searchParams.get(key) ?? fallback;
}

export interface CmAdminQueue {
  id: string;
  count: number;
  route: string;
}

function queuesFor(overview: CmAdminOverviewData): CmAdminQueue[] {
  return [
    { id: 'kyc', count: overview.kyc_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.kyc, { status: 'pending' }) },
    { id: 'deposits', count: overview.deposits_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.deposits, { status: 'pending' }) },
    { id: 'refunds', count: overview.refunds_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.refunds, { status: 'pending' }) },
    { id: 'withdrawals', count: overview.withdrawals_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.withdrawals, { status: 'pending' }) },
    { id: 'roles', count: overview.roles_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.users, { status: 'pending' }) },
    { id: 'testimonials', count: overview.testimonials_pending, route: cmRouteWithQuery(CM_ADMIN_ROUTE.testimonials, { status: 'pending' }) },
    { id: 'contact', count: overview.contact_messages_new, route: cmRouteWithQuery(CM_ADMIN_ROUTE.contactMessages, { status: 'new' }) },
  ];
}

export interface CmAdminTotal {
  key: string;
  value: number;
  route: string | null;
}

export interface CmAdminOverviewModel {
  overview: CmAdminOverviewData | null;
  policy: CmAdminPolicy | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  openQueues: CmAdminQueue[];
  clearQueues: CmAdminQueue[];
  pendingTotal: number;
  totals: CmAdminTotal[];
  projectCounts: Record<string, number>;
  projectStatuses: string[];
}

/** Console overview: pending queues, platform totals, projects by status and the policy figures. */
export function useCmAdminOverview(): CmAdminOverviewModel {
  const { t } = useTranslation('cm');
  const { states } = useCmBootstrap();
  const [overview, setOverview] = useState<CmAdminOverviewData | null>(null);
  const [policy, setPolicy] = useState<CmAdminPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const [overviewResponse, policyResponse] = await Promise.all([cmAdminApi.overview(), cmAdminApi.policy()]);
    if (overviewResponse.success && overviewResponse.data) {
      setOverview(overviewResponse.data);
    } else {
      setOverview(null);
      setError(cmErrorMessage(t, overviewResponse, 'admin.loadFailed'));
    }
    setPolicy(policyResponse.success && policyResponse.data ? policyResponse.data : null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const queues = overview ? queuesFor(overview) : [];
  const openQueues = queues.filter((queue) => queue.count > 0);
  const projectCounts = overview?.projects_by_status ?? {};
  const knownProjectStatuses = states('project');
  const totals: CmAdminTotal[] = overview ? [
    { key: 'users', value: overview.users_total, route: CM_ADMIN_ROUTE.users },
    { key: 'roleHolders', value: overview.codeMart_role_holders, route: cmRouteWithQuery(CM_ADMIN_ROUTE.users, { status: 'active' }) },
    { key: 'projects', value: overview.projects_total, route: CM_ADMIN_ROUTE.projects },
    { key: 'tasks', value: overview.tasks_total, route: null },
    { key: 'reviewersPassed', value: overview.reviewer_applications_passed, route: cmRouteWithQuery(CM_ADMIN_ROUTE.reviewerApplications, { status: 'passed' }) },
  ] : [];

  return {
    overview,
    policy,
    loading,
    error,
    load,
    openQueues,
    clearQueues: queues.filter((queue) => queue.count === 0),
    pendingTotal: openQueues.reduce((sum, queue) => sum + queue.count, 0),
    totals,
    projectCounts,
    projectStatuses: [
      ...knownProjectStatuses.filter((status) => projectCounts[status]),
      ...Object.keys(projectCounts).filter((status) => !knownProjectStatuses.includes(status)),
    ],
  };
}

export interface CmAdminKycDocumentModel {
  available: string[];
  active: CmAdminKycDocument | null;
  objectUrl: string | null;
  loading: boolean;
  error: string | null;
  open: (type: CmAdminKycDocument) => Promise<void>;
}

/** Authenticated private KYC document preview (blob -> object URL, revoked on change/unmount). */
export function useCmAdminKycDocument(kycId: number, documents: CmAdminKycRecord['documents']): CmAdminKycDocumentModel {
  const { t } = useTranslation('cm');
  const { policyList } = useCmBootstrap();
  const [active, setActive] = useState<CmAdminKycDocument | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const available = policyList('kyc_document_slots').filter((type) => documents?.[type]);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const open = async (type: CmAdminKycDocument): Promise<void> => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setObjectUrl(null);
    setError(null);
    if (active === type) {
      setActive(null);
      setLoading(false);
      return;
    }
    setActive(type);
    setLoading(true);
    const response = await cmAdminApi.kycFile(kycId, type);
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (response.success && response.data) {
      setObjectUrl(URL.createObjectURL(response.data));
    } else {
      setError(cmErrorMessage(t, response, 'admin.kyc.documentFailed'));
    }
  };

  return { available, active, objectUrl, loading, error, open };
}

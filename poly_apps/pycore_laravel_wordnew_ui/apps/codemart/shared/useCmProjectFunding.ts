import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProjectDetail, CmWallet } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { useCmIdempotencyKey } from '../api/useCmIdempotencyKey';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import type { CmFeedback } from './cmFeedback';

const APPROVED_PROPOSAL_STATUS = 'approved';
const INSUFFICIENT_BALANCE = 'insufficient_balance';

export interface CmProjectFundingModel {
  fundingAmount: string | null;
  wallet: CmWallet | null;
  loading: boolean;
  busy: boolean;
  /** The wallet cannot cover the escrow amount. */
  shortfall: boolean;
  /** The server answered insufficient_balance on the last attempt. */
  needsTopUp: boolean;
  fund: () => Promise<boolean>;
}

/** Owner funds the accepted proposal into escrow; the server moves the project to open. */
export function useCmProjectFunding(project: CmProjectDetail, onFunded: () => Promise<void>, feedback: CmFeedback): CmProjectFundingModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const idempotency = useCmIdempotencyKey();
  const [fundingAmount, setFundingAmount] = useState<string | null>(null);
  const [wallet, setWallet] = useState<CmWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsTopUp, setNeedsTopUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([cmApi.getProjectAnalysis(project.id), cmApi.getWallet()]).then(([analysisResponse, walletResponse]) => {
      if (cancelled) return;
      const proposal = analysisResponse.success ? analysisResponse.data?.proposal ?? null : null;
      const proposalAmount = proposal && proposal.status === APPROVED_PROPOSAL_STATUS && proposal.estimated_cost && Number(proposal.estimated_cost) > 0
        ? proposal.estimated_cost
        : null;
      setFundingAmount(proposalAmount ?? project.budget);
      if (walletResponse.success && walletResponse.data) setWallet(walletResponse.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.budget]);

  const shortfall = Boolean(wallet && fundingAmount !== null && Number(wallet.available_balance) < Number(fundingAmount));

  const fund = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    feedback.clear();
    setNeedsTopUp(false);
    const response = await cmApi.fundProject(project.id, idempotency.current());
    setBusy(false);
    if (response.success && response.data) {
      idempotency.reset();
      feedback.success(t('funding.funded', { amount: format.money(response.data.escrow.amount, response.data.escrow.currency ?? project.currency) }));
      await onFunded();
      return true;
    }
    setNeedsTopUp(cmErrorCode(response) === INSUFFICIENT_BALANCE);
    feedback.error(cmErrorMessage(t, response, 'funding.failed'));
    return false;
  }, [busy, feedback, project.id, project.currency, idempotency, format, onFunded, t]);

  return { fundingAmount, wallet, loading, busy, shortfall, needsTopUp, fund };
}

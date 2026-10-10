import React, { useMemo, useState } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { cmAdminApi } from '../../../../admin/CmAdminApi';
import type { CmAdminKycRecord } from '../../../../admin/CmAdminTypes';
import { useCmAdminKycDocument, useCmAdminList, useCmAdminParam } from '../../../../admin/useCmAdminData';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { MobileButton, MobileNotice, MobileScreen, MobileStatusBadge, MobileSkeletonBlock } from '../../../ui';
import { AdminRecord, AdminRecordList, AdminSearch, AdminStatusFilter, AdminUserLink, useAdminText, useMobileAdminActions } from './MobileAdminParts';

/** Private KYC document preview behind the administrator's session (blob -> object URL, revoked on change). */
const KycDocuments: React.FC<{ item: CmAdminKycRecord }> = ({ item }) => {
  const { t } = useTranslation('cm');
  const { available, active, objectUrl, loading, error, open } = useCmAdminKycDocument(item.id, item.documents);

  if (available.length === 0) return <p className="cmm-muted">{t('admin.kyc.noDocuments')}</p>;
  return (
    <div className="cmmc-documents">
      <div className="cmmc-row-actions" role="group" aria-label={t('admin.kyc.documents')}>
        {available.map((type) => (
          <MobileButton key={type} small variant={active === type ? 'primary' : 'secondary'} icon={<Eye aria-hidden="true" />} onClick={() => void open(type)}>
            {t(`admin.kyc.document.${type}`)}
          </MobileButton>
        ))}
      </div>
      {active && loading && <MobileSkeletonBlock height={160} />}
      {error && <MobileNotice tone="error">{error}</MobileNotice>}
      {active && objectUrl && (
        <figure className="cmmc-document">
          <img src={objectUrl} alt={t(`admin.kyc.document.${active}`)} />
          <figcaption>{t('admin.kyc.privateNote')}</figcaption>
        </figure>
      )}
    </div>
  );
};

/** KYC review queue: documents, approve with optional notes, reject with a reason. */
export const MobileAdminKycScreen: React.FC = () => {
  const { t, dateTime } = useAdminText();
  const { states } = useCmBootstrap();
  const [status, setStatus] = useState(useCmAdminParam('status', 'pending'));
  const [search, setSearch] = useState(useCmAdminParam('search'));
  const filters = useMemo(() => ({ status, search }), [status, search]);
  const list = useCmAdminList((query) => cmAdminApi.kyc(query), filters);
  const actions = useMobileAdminActions(list.reload);

  return (
    <MobileScreen title={t('admin.nav.kyc')} onRefresh={list.reload}>
      <AdminSearch value={search} onApply={setSearch} placeholder={t('admin.searchKyc')} />
      <AdminStatusFilter ariaLabel={t('admin.filterStatus')} value={status} onChange={setStatus} options={states('kyc')} optionLabel={(option) => t(`states.kyc.${option}`)} />
      <AdminRecordList
        list={list}
        emptyKey="admin.noKyc"
        renderRecord={(item) => (
          <AdminRecord
            key={item.id}
            title={item.real_name}
            badge={<MobileStatusBadge status={item.verification_status} prefix="states.kyc" />}
            facts={[
              { label: t('admin.columnUser'), value: <AdminUserLink user={item.user} userId={item.user_id} /> },
              { label: t('admin.kyc.identityType'), value: t(`admin.kyc.identity.${item.identity_type}`, { defaultValue: item.identity_type }) },
              { label: t('admin.kyc.submittedAt'), value: dateTime(item.submitted_at) },
              item.verified_at ? { label: t('admin.kyc.reviewedAt'), value: dateTime(item.verified_at) } : null,
            ]}
            note={item.verification_notes ? t('admin.notesValue', { notes: item.verification_notes }) : undefined}
            actions={item.reviewable && (
              <>
                <MobileButton variant="primary" icon={<Check aria-hidden="true" />} onClick={() => actions.approveKyc(item)}>{t('admin.approve')}</MobileButton>
                <MobileButton variant="danger" icon={<X aria-hidden="true" />} onClick={() => actions.rejectKyc(item)}>{t('admin.reject')}</MobileButton>
              </>
            )}
          >
            <KycDocuments item={item} />
          </AdminRecord>
        )}
      />
      {actions.sheet}
    </MobileScreen>
  );
};

export default MobileAdminKycScreen;

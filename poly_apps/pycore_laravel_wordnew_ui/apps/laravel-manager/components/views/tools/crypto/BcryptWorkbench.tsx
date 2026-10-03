/** bcrypt hash & verify (server-side): cost slider with work-factor feedback, hash anatomy and a verify verdict. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, LockKeyhole, ShieldQuestion, TriangleAlert, XCircle } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { callToolApi, useToolRun } from '../toolRunner';
import { utf8Encode } from './lib/cryptoCore';
import { FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_BUTTON, VAULT_FIELD, VAULT_GHOST_BUTTON, VaultPage, VaultPanel, VaultRange, readSettings, useVaultRecorder } from './cryptoKit';

type BcryptTab = 'hash' | 'verify';

interface BcryptSettings {
  rounds: number;
}

const DEFAULT_SETTINGS: BcryptSettings = { rounds: 12 };
const MIN_ROUNDS = 4;
const MAX_ROUNDS = 14;
const SLOW_ROUNDS = 13;
const PASSWORD_BYTE_LIMIT = 72;
const BCRYPT_PATTERN = /^\$(2[abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;
const ANATOMY_TONES = ['text-sky-300', 'text-amber-300', 'text-fuchsia-300', 'text-emerald-300'];

const parseBcrypt = (hash: string): { prefix: string; cost: number; salt: string; digest: string } | null => {
  const match = BCRYPT_PATTERN.exec(hash.trim());
  return match ? { prefix: match[1], cost: Number(match[2]), salt: match[3], digest: match[4] } : null;
};

const BcryptWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_SETTINGS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const hashRun = useToolRun<string>(tool.id, variant);
  const verifyRun = useToolRun<boolean>(tool.id, variant);
  const [tab, setTab] = useState<BcryptTab>(variant === 'bcryptVerifier' ? 'verify' : 'hash');
  const [rounds, setRounds] = useState(Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, initial.rounds)));
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [candidate, setCandidate] = useState('');
  const hashed = hashRun.result ?? '';
  const anatomy = useMemo(() => parseBcrypt(hashed), [hashed]);
  const candidateInfo = useMemo(() => parseBcrypt(candidate), [candidate]);
  const tooLong = utf8Encode(tab === 'hash' ? password : verifyPassword).length > PASSWORD_BYTE_LIMIT;
  const candidateInvalid = candidate.trim() !== '' && !candidateInfo;

  const hash = (): void => {
    void hashRun.run({ rounds }, async () => {
      const data = await callToolApi<{ hash: string }>('itToolsV1.bcryptHash', { password, rounds });
      record({ rounds }, { cost: rounds });
      return data.hash;
    }, false);
  };

  const verify = (): void => {
    void verifyRun.run({}, async () => {
      const data = await callToolApi<{ valid: boolean }>('itToolsV1.bcryptVerify', { password: verifyPassword, hash: candidate.trim() });
      record({ rounds }, { valid: data.valid });
      return data.valid;
    }, false);
  };

  const useHashForVerify = (): void => {
    setCandidate(hashed);
    setVerifyPassword(password);
    verifyRun.reset();
    setTab('verify');
  };

  return (
    <VaultPage server>
      <ModeTabs value={tab} onChange={setTab} label={t('toolsCrypto.bcryptGenerator.tab')} options={[
        { value: 'hash', label: t('toolsCrypto.bcryptGenerator.tab_hash') },
        { value: 'verify', label: t('toolsCrypto.bcryptGenerator.tab_verify') },
      ]} />

      {tab === 'hash' ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <VaultPanel title={t('toolsCrypto.bcryptGenerator.hash_title')} icon={LockKeyhole} className="space-y-4">
            <SecretInput id="bcrypt-password" value={password} onChange={(value) => { setPassword(value); hashRun.reset(); }} label={t('toolsCrypto.bcryptGenerator.password')} />
            <VaultRange label={t('toolsCrypto.bcryptGenerator.cost')} value={rounds} min={MIN_ROUNDS} max={MAX_ROUNDS} onChange={setRounds} />
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{t('toolsCrypto.bcryptGenerator.cost_note', { iterations: (2 ** rounds).toLocaleString() })}</p>
            {rounds >= SLOW_ROUNDS && <p className="flex items-start gap-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-400"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{t('toolsCrypto.bcryptGenerator.slow_warning')}</p>}
            {tooLong && <Hint tone="warn">{t('toolsCrypto.bcryptGenerator.length_warning', { limit: PASSWORD_BYTE_LIMIT })}</Hint>}
            <button type="button" onClick={hash} disabled={!password || hashRun.running} className={`${VAULT_BUTTON} w-full`}>
              {hashRun.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}
              {t('toolsCrypto.bcryptGenerator.run_hash')}
            </button>
            <Hint>{t('toolsCrypto.bcryptGenerator.server_note')}</Hint>
          </VaultPanel>

          <VaultPanel title={t('toolsCrypto.bcryptGenerator.result_title')} vault className="space-y-3">
            {hashRun.error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300">{hashRun.error}</p>}
            <Readout label="bcrypt" value={hashed} emptyText={t('toolsCrypto.bcryptGenerator.result_empty')} />
            {anatomy && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{t('toolsCrypto.bcryptGenerator.anatomy')}</p>
                <p className="break-all font-mono text-xs leading-relaxed">
                  <span className={ANATOMY_TONES[0]}>${anatomy.prefix}$</span>
                  <span className={ANATOMY_TONES[1]}>{String(anatomy.cost).padStart(2, '0')}$</span>
                  <span className={ANATOMY_TONES[2]}>{anatomy.salt}</span>
                  <span className={ANATOMY_TONES[3]}>{anatomy.digest}</span>
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]">
                  <li className={ANATOMY_TONES[0]}>{t('toolsCrypto.bcryptGenerator.part_version')}</li>
                  <li className={ANATOMY_TONES[1]}>{t('toolsCrypto.bcryptGenerator.part_cost')}</li>
                  <li className={ANATOMY_TONES[2]}>{t('toolsCrypto.bcryptGenerator.part_salt')}</li>
                  <li className={ANATOMY_TONES[3]}>{t('toolsCrypto.bcryptGenerator.part_digest')}</li>
                </ul>
              </div>
            )}
            {hashed && <button type="button" onClick={useHashForVerify} className={`${VAULT_GHOST_BUTTON} !border-emerald-400/20 !bg-emerald-400/10 !text-emerald-300`}>{t('toolsCrypto.bcryptGenerator.send_to_verify')}</button>}
          </VaultPanel>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <VaultPanel title={t('toolsCrypto.bcryptGenerator.verify_title')} className="space-y-4">
            <SecretInput id="bcrypt-verify-password" value={verifyPassword} onChange={(value) => { setVerifyPassword(value); verifyRun.reset(); }} label={t('toolsCrypto.bcryptGenerator.password')} />
            <div>
              <FieldLabel htmlFor="bcrypt-candidate">{t('toolsCrypto.bcryptGenerator.hash_to_check')}</FieldLabel>
              <input id="bcrypt-candidate" value={candidate} onChange={(event) => { setCandidate(event.target.value); verifyRun.reset(); }} spellCheck={false} autoComplete="off"
                placeholder="$2y$12$..." className={VAULT_FIELD} />
              {candidateInvalid && <div className="mt-1.5"><Hint tone="error">{t('toolsCrypto.bcryptGenerator.hash_invalid')}</Hint></div>}
              {candidateInfo && <div className="mt-1.5"><Hint>{t('toolsCrypto.bcryptGenerator.hash_info', { prefix: candidateInfo.prefix, cost: candidateInfo.cost })}</Hint></div>}
            </div>
            {tooLong && <Hint tone="warn">{t('toolsCrypto.bcryptGenerator.length_warning', { limit: PASSWORD_BYTE_LIMIT })}</Hint>}
            <button type="button" onClick={verify} disabled={!verifyPassword || !candidateInfo || verifyRun.running} className={`${VAULT_BUTTON} w-full`}>
              {verifyRun.running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldQuestion className="h-4 w-4" aria-hidden />}
              {t('toolsCrypto.bcryptGenerator.run_verify')}
            </button>
          </VaultPanel>

          <VaultPanel title={t('toolsCrypto.bcryptGenerator.verdict_title')} vault>
            {verifyRun.error ? (
              <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300">{verifyRun.error}</p>
            ) : verifyRun.result === null ? (
              <p className="flex items-center gap-2 font-mono text-sm text-emerald-500/50"><ShieldQuestion className="h-6 w-6" aria-hidden />{t('toolsCrypto.bcryptGenerator.verdict_idle')}</p>
            ) : verifyRun.result ? (
              <p className="flex items-center gap-2 font-mono text-lg font-black text-emerald-300"><CheckCircle2 className="h-7 w-7" aria-hidden />{t('toolsCrypto.bcryptGenerator.verdict_match')}</p>
            ) : (
              <p className="flex items-center gap-2 font-mono text-lg font-black text-rose-400"><XCircle className="h-7 w-7" aria-hidden />{t('toolsCrypto.bcryptGenerator.verdict_mismatch')}</p>
            )}
          </VaultPanel>
        </div>
      )}
    </VaultPage>
  );
};

export default BcryptWorkbench;

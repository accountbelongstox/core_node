import { useCallback, useEffect, useState } from 'react';

export type CmBrandForm = 'mark' | 'lockup' | 'text';

export interface CmBrandFormFiles {
  svg?: string;
  png?: string;
  white?: string;
  current?: string;
}

export interface CmBrandScore {
  iou: number;
  ssim: number;
  score: number;
}

export interface CmBrandCandidate {
  id: string;
  method: string;
  round: number;
  tool: string;
  kind: 'vector' | 'raster';
  status: 'ok' | 'unavailable';
  created_at: string;
  note: string;
  score: CmBrandScore | null;
  nodes?: number;
  files: Partial<Record<CmBrandForm, CmBrandFormFiles>>;
}

export interface CmBrandManifest {
  source: { file: string; width: number; height: number };
  default: string | null;
  ranking: string[];
  forms: Record<CmBrandForm, [number, number, number, number]>;
  candidates: CmBrandCandidate[];
}

export const CM_BRAND_FORMS: readonly CmBrandForm[] = ['mark', 'lockup', 'text'];
export const CM_BRAND_METHODS: readonly string[] = ['A', 'B', 'C'];
export const CM_BRAND_SIZES: readonly number[] = [16, 32, 64, 192, 512];
const PICK_STORAGE_KEY = 'cm.brandGallery.pick';
const CANDIDATE_ASSET_PREFIX = '../../assets/brand/candidates/';
const SOURCE_ASSET_PREFIX = '../../assets/brand/';

const assetUrls = import.meta.glob('../../assets/brand/{candidates,source}/**/*.{svg,png,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function cmBrandCandidateUrl(candidateId: string, file: string | undefined): string | undefined {
  return file ? assetUrls[`${CANDIDATE_ASSET_PREFIX}${candidateId}/${file}`] : undefined;
}

export function cmBrandSourceUrl(manifest: CmBrandManifest): string | undefined {
  return assetUrls[`${SOURCE_ASSET_PREFIX}${manifest.source.file}`];
}

export interface CmBrandManifestState {
  manifest: CmBrandManifest | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

export function useCmBrandManifest(): CmBrandManifestState {
  const [manifest, setManifest] = useState<CmBrandManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    import('../../assets/brand/manifest.json')
      .then((module) => {
        if (active) setManifest(module.default as unknown as CmBrandManifest);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { manifest, loading, failed, reload };
}

function readPick(): string {
  try {
    return window.localStorage.getItem(PICK_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** The visitor's choice, kept in localStorage; the candidate id is shown so it can be told to the AI. */
export function useCmBrandPick(): { pick: string; setPick: (id: string) => void } {
  const [pick, setPickState] = useState(readPick);
  const setPick = useCallback((id: string) => {
    setPickState(id);
    try {
      if (id) window.localStorage.setItem(PICK_STORAGE_KEY, id);
      else window.localStorage.removeItem(PICK_STORAGE_KEY);
    } catch {
      /* storage unavailable: the pick stays for this page view */
    }
  }, []);
  return { pick, setPick };
}

export function groupCandidates(candidates: CmBrandCandidate[]): Array<{ method: string; rounds: Array<{ round: number; items: CmBrandCandidate[] }> }> {
  return CM_BRAND_METHODS.map((method) => {
    const items = candidates.filter((candidate) => candidate.method === method);
    const rounds = Array.from(new Set(items.map((candidate) => candidate.round))).sort((a, b) => a - b);
    return { method, rounds: rounds.map((round) => ({ round, items: items.filter((candidate) => candidate.round === round) })) };
  }).filter((group) => group.rounds.length > 0);
}

export function fitEdge(aspect: number, size: number): { width: number; height: number } {
  return aspect >= 1 ? { width: size, height: Math.max(1, Math.round(size / aspect)) } : { width: Math.max(1, Math.round(size * aspect)), height: size };
}

/**
 * Sentence audio variant selection for book reader / library cells.
 */
import { absUrl } from '../api/WfNewApiMappers';
import type { WfAudioFileVariant, WfNewBookVerseLang } from '../api/types/media';
import { mapUiAccent } from '../hooks/wfWordAudioFallback';

export interface WfSentenceAudioPick {
  url: string | null;
  variantKey: string;
  accent: string | null;
  isFallback: boolean;
}

/** Human label for a variant chip (e.g. "US · F"). */
export function sentenceVariantLabel(v: WfAudioFileVariant, trans?: (k: string) => string): string {
  const accent = (v.accent || '—').toUpperCase();
  const gender = v.gender ? v.gender.charAt(0).toUpperCase() : '—';
  const primary = trans?.('reader.variantPrimary') ?? 'Primary';
  if (!v.variantKey) return `${primary} (${accent})`;
  return `${accent} · ${gender}`;
}

/** Map settings voiceAccent → preferred wire accent. */
export function readerPreferredAccent(uiAccent: string): 'us' | 'uk' {
  return mapUiAccent(uiAccent);
}

/** Pick best ready URL from verse cell audio_files + legacy audio field. */
export function pickSentenceAudioUrl(
  cell: WfNewBookVerseLang | undefined,
  opts: { variantKey?: string; preferredAccent?: 'us' | 'uk' } = {},
): WfSentenceAudioPick {
  const files = (cell?.audioFiles ?? []).filter((f) => f.hasFile && f.url);
  const variantKey = opts.variantKey ?? '';
  const preferred = opts.preferredAccent;

  if (variantKey !== undefined && variantKey !== null) {
    const exact = files.find((f) => (f.variantKey ?? '') === variantKey);
    if (exact?.url) {
      return {
        url: absUrl(exact.url) ?? null,
        variantKey,
        accent: exact.accent ?? null,
        isFallback: false,
      };
    }
  }

  if (preferred) {
    const byAccent = files.find((f) => f.accent === preferred);
    if (byAccent?.url) {
      return {
        url: absUrl(byAccent.url) ?? null,
        variantKey: byAccent.variantKey ?? '',
        accent: byAccent.accent ?? null,
        isFallback: false,
      };
    }
  }

  const any = files[0];
  if (any?.url) {
    return {
      url: absUrl(any.url) ?? null,
      variantKey: any.variantKey ?? '',
      accent: any.accent ?? null,
      isFallback: preferred != null && any.accent !== preferred,
    };
  }

  if (cell?.hasAudio && cell.audio) {
    return {
      url: absUrl(cell.audio) ?? null,
      variantKey: '',
      accent: null,
      isFallback: false,
    };
  }

  return { url: null, variantKey: '', accent: null, isFallback: false };
}

/** Ready variants suitable for the accent picker UI. */
export function readySentenceVariants(cell: WfNewBookVerseLang | undefined): WfAudioFileVariant[] {
  const files = cell?.audioFiles ?? [];
  const ready = files.filter((f) => f.hasFile && f.url);
  if (ready.length > 1) return ready;
  return [];
}

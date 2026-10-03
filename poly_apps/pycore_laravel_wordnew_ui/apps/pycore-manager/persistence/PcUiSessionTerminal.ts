import type { TerminalWindowInfo } from '@/apps/pycore-manager/api';
import type { PcUiSessionTerminalIdentity } from './PcUiSessionStore';

function windowTitle(windowInfo: TerminalWindowInfo): string {
  return String(windowInfo.custom_title || windowInfo.title || '').trim();
}

function savedTitle(identity: PcUiSessionTerminalIdentity): string {
  return identity.title.trim();
}

export function pcTerminalIdentityOf(windowInfo: TerminalWindowInfo): PcUiSessionTerminalIdentity {
  return {
    number: windowInfo.terminal_number,
    id: String(windowInfo.id || ''),
    nativeId: String(windowInfo.native_id ?? ''),
    processId: Number(windowInfo.process_id) || 0,
    title: windowTitle(windowInfo),
    app: String(windowInfo.app || ''),
  };
}

// Terminal numbers, window ids and process ids can all change when the machine or its terminal
// host restarts, so the saved terminal is matched from the strongest identity to the weakest and
// never by a bare number alone (a renumbered window would silently become another terminal).
export function matchPcTerminalWindow(
  windows: readonly TerminalWindowInfo[],
  identity: PcUiSessionTerminalIdentity | null,
): TerminalWindowInfo | null {
  if (!identity) return null;
  const sameApp = (windowInfo: TerminalWindowInfo) => String(windowInfo.app || '') === identity.app;
  const sameNumber = (windowInfo: TerminalWindowInfo) => windowInfo.terminal_number === identity.number;
  const title = savedTitle(identity);
  const sameTitle = (windowInfo: TerminalWindowInfo) => title !== '' && windowTitle(windowInfo) === title;
  const unique = (candidates: TerminalWindowInfo[]) => (candidates.length === 1 ? candidates[0] : null);

  const byId = identity.id ? windows.find((windowInfo) => windowInfo.id === identity.id) : undefined;
  if (byId) return byId;
  const byNative = identity.nativeId
    ? windows.find((windowInfo) => sameNumber(windowInfo) && String(windowInfo.native_id ?? '') === identity.nativeId)
    : undefined;
  if (byNative) return byNative;
  const byProcess = identity.processId
    ? windows.find((windowInfo) => sameNumber(windowInfo) && sameApp(windowInfo) && windowInfo.process_id === identity.processId)
    : undefined;
  if (byProcess) return byProcess;
  const byNumberAndTitle = windows.find((windowInfo) => sameNumber(windowInfo) && sameApp(windowInfo) && sameTitle(windowInfo));
  if (byNumberAndTitle) return byNumberAndTitle;
  const byTitle = unique(windows.filter((windowInfo) => sameApp(windowInfo) && sameTitle(windowInfo)));
  if (byTitle) return byTitle;
  return unique(windows.filter((windowInfo) => sameNumber(windowInfo) && sameApp(windowInfo)));
}

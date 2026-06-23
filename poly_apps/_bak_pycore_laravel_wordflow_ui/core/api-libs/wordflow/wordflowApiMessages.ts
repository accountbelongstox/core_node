/**
 * User-facing Wordflow API error strings for the transport layer.
 *
 * Mirrored from apps/wordflow/wf-locales/*.ts (common.backendHtmlResponse,
 * common.backendUnavailable). The core api-lib must not import from apps/.
 * KEEP IN SYNC when editing wf-locales.
 */

/** Stable probe-failure codes stored on HealthCheckResult.error (UI maps via t()). */
export const WF_PROBE_ERROR = {
  HTML: 'WF_PROBE_HTML',
  TIMEOUT: 'WF_PROBE_TIMEOUT',
  SSL: 'WF_PROBE_SSL',
  CONNECTION: 'WF_PROBE_CONNECTION',
  HTTP: 'WF_PROBE_HTTP',
} as const;

export type WfProbeErrorCode = (typeof WF_PROBE_ERROR)[keyof typeof WF_PROBE_ERROR];

const BACKEND_HTML_RESPONSE_MESSAGES: Record<string, string> = {
  en: 'Backend API unavailable: received a web page instead of JSON. Start Laravel on port 9000 (poly_apps/laravel_main), or choose a working endpoint under Settings → API Server.',
  zh: '后端 API 不可用：收到的是网页而非 JSON。请启动 Laravel（:9000，目录 poly_apps/laravel_main），或在 设置 → API 服务器 中选择可用端点。',
  ja: 'バックエンド API に接続できません：JSON ではなく Web ページが返されました。Laravel を :9000 で起動するか、設定 → API サーバー で利用可能なエンドポイントを選んでください。',
  ko: '백엔드 API를 사용할 수 없습니다: JSON 대신 웹 페이지가 반환되었습니다. Laravel을 :9000에서 실행하거나 설정 → API 서버에서 사용 가능한 엔드포인트를 선택하세요.',
  es: 'API del backend no disponible: se recibió una página web en lugar de JSON. Inicia Laravel en el puerto 9000 o elige un endpoint válido en Ajustes → Servidor API.',
  fr: 'API backend indisponible : une page web a été reçue au lieu de JSON. Démarrez Laravel sur le port 9000 ou choisissez un endpoint valide dans Réglages → Serveur API.',
  de: 'Backend-API nicht erreichbar: Es wurde eine Webseite statt JSON empfangen. Starten Sie Laravel auf Port 9000 oder wählen Sie unter Einstellungen → API-Server einen funktionierenden Endpunkt.',
};

const BACKEND_UNAVAILABLE_MESSAGES: Record<string, string> = {
  en: 'Cannot reach the backend API. Ensure Laravel is running on port 9000, or switch endpoint under Settings → API Server.',
  zh: '无法连接后端 API。请确认 Laravel 已在 :9000 启动，或在 设置 → API 服务器 中切换端点。',
  ja: 'バックエンド API に接続できません。Laravel が :9000 で起動しているか確認するか、設定 → API サーバー でエンドポイントを切り替えてください。',
  ko: '백엔드 API에 연결할 수 없습니다. Laravel이 :9000에서 실행 중인지 확인하거나 설정 → API 서버에서 엔드포인트를 변경하세요.',
  es: 'No se puede contactar con la API del backend. Comprueba que Laravel esté en el puerto 9000 o cambia el endpoint en Ajustes → Servidor API.',
  fr: 'Impossible de joindre l\'API backend. Vérifiez que Laravel tourne sur le port 9000 ou changez d\'endpoint dans Réglages → Serveur API.',
  de: 'Backend-API nicht erreichbar. Stellen Sie sicher, dass Laravel auf Port 9000 läuft, oder wechseln Sie den Endpunkt unter Einstellungen → API-Server.',
};

/** Resolve UI language: shell_lang localStorage → host hint → en. */
export function resolveShellLang(hostLang?: string): string {
  let lang = '';
  try {
    if (typeof localStorage !== 'undefined') {
      lang = (localStorage.getItem('shell_lang') || '').toLowerCase();
    }
  } catch {
    /* storage denied */
  }
  if (!lang) lang = (hostLang || '').toLowerCase();
  if (!lang) {
    try {
      lang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    } catch {
      lang = '';
    }
  }
  return lang.split('-')[0] || 'en';
}

function pickMessage(map: Record<string, string>, lang?: string): string {
  const key = resolveShellLang(lang);
  return map[key] ?? map.en;
}

export function backendHtmlResponseMessage(lang?: string): string {
  return pickMessage(BACKEND_HTML_RESPONSE_MESSAGES, lang);
}

export function backendUnavailableMessage(lang?: string): string {
  return pickMessage(BACKEND_UNAVAILABLE_MESSAGES, lang);
}

export function isHtmlLikeBody(text: string): boolean {
  const head = text.trimStart().slice(0, 256).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html');
}

export function isHtmlJsonParseError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false;
  return /unexpected token '<'|is not valid json/i.test(error.message);
}

function isNetworkLevelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('net::err_')
  );
}

function isSslError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('ssl') ||
    msg.includes('certificate') ||
    msg.includes('cert_') ||
    msg.includes('tls') ||
    msg.includes('secure channel')
  );
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return error.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
}

/** Classify a health-probe failure for HealthCheckResult.error (UI maps via t()). */
export function classifyProbeFailure(error: unknown): WfProbeErrorCode {
  if (isTimeoutError(error)) return WF_PROBE_ERROR.TIMEOUT;
  if (isSslError(error)) return WF_PROBE_ERROR.SSL;
  return WF_PROBE_ERROR.CONNECTION;
}

/**
 * Turn low-level fetch/parse failures into a short, actionable Error.message
 * for UI toasts and inline error states.
 */
export function formatWordflowRequestError(
  error: unknown,
  lang?: string
): Error {
  if (error instanceof Error) {
    if (
      error.message.includes('Backend API') ||
      error.message.includes('后端 API') ||
      error.message.includes('バックエンド API') ||
      error.message.startsWith('API Error:')
    ) {
      return error;
    }
  }

  if (isHtmlJsonParseError(error)) {
    return new Error(backendHtmlResponseMessage(lang));
  }

  if (isNetworkLevelError(error) || isTimeoutError(error) || isSslError(error)) {
    return new Error(backendUnavailableMessage(lang));
  }

  if (error instanceof Error) return error;
  return new Error(backendUnavailableMessage(lang));
}

/** Parse a success response body; throws a friendly Error when HTML is returned. */
export function parseWordflowJsonBody(rawText: string, lang?: string): unknown {
  if (!rawText) return null;
  if (isHtmlLikeBody(rawText)) {
    throw new Error(backendHtmlResponseMessage(lang));
  }
  try {
    return JSON.parse(rawText);
  } catch (error) {
    if (isHtmlJsonParseError(error) || isHtmlLikeBody(rawText)) {
      throw new Error(backendHtmlResponseMessage(lang));
    }
    throw formatWordflowRequestError(error, lang);
  }
}

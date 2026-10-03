/** WiFi join payload (WIFI: URI scheme understood by Android and iOS cameras). */

export type WifiEncryption = 'WPA' | 'WEP' | 'nopass';

const SPECIAL = /([\\;,:"])/g;
const HEX_ONLY = /^[0-9a-fA-F]+$/;

const escapeValue = (value: string): string => {
  const escaped = value.replace(SPECIAL, '\\$1');
  return HEX_ONLY.test(value) ? `"${escaped}"` : escaped;
};

export const buildWifiPayload = (ssid: string, password: string, encryption: WifiEncryption, hidden: boolean): string => {
  if (!ssid) return '';
  const parts = [`T:${encryption}`, `S:${escapeValue(ssid)}`];
  if (encryption !== 'nopass' && password) parts.push(`P:${escapeValue(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
};

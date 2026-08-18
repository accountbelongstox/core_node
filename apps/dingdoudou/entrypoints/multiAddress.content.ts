// Multi-address selection automation for Pinduoduo checkout and the address
// book. Ported from the original DDK multiAddressAutomation script.
//
// Action 'selectAddress' { keyword } picks the delivery address whose text
// contains the keyword (recipient name, phone, or any address fragment) and
// taps it. Works on both the checkout address picker and addresses.html.
//
// Runs at document_start in all frames.

import {
  clickEl,
  domReady,
  findByText,
  isVisible,
  onAction,
  queryAll,
  sendDdEvent,
  sleep,
  textOf,
  waitFor,
  type ActionMessage,
  type ActionResult,
} from '@/lib/domAuto';

// Candidate selectors for a single address row/card (best-effort heuristics).
const ADDRESS_ROW_SELECTOR = [
  '[class*="address-item"]',
  '[class*="addressItem"]',
  '[class*="address_item"]',
  '[class*="address-card"]',
  '[class*="addressCard"]',
  '[class*="addressList"] li',
  '[class*="address-list"] li',
  '[class*="addr"]',
  'li',
].join(',');

// A row looks like an address if it mentions a province/region word, a phone
// number, or a "default address" marker — and is reasonably short.
const REGION_HINT =
  /(省|市|区|县|street|路|号|栋|室|默认地址|收货人|联系电话|\d{3,4}\*{2,}\d{2,4})/;

function looksLikeAddressRow(el: HTMLElement): boolean {
  if (!isVisible(el)) return false;
  const t = textOf(el);
  if (!t || t.length < 4 || t.length > 240) return false;
  return REGION_HINT.test(t);
}

// Collect address rows, keeping only the innermost matches (drop wrappers that
// contain another address row).
function collectAddressRows(): HTMLElement[] {
  const all = queryAll<HTMLElement>(ADDRESS_ROW_SELECTOR).filter(looksLikeAddressRow);
  const set = new Set(all);
  return all.filter((el) => !all.some((other) => other !== el && set.has(other) && el.contains(other)));
}

async function selectAddress(msg: ActionMessage): Promise<ActionResult> {
  const keyword = String((msg.keyword as string) ?? (msg.text as string) ?? '').trim();
  if (!keyword) return { success: false, detail: 'no keyword provided' };

  // Wait for the address list to render (it can lazy-load on checkout).
  await waitFor(() => (collectAddressRows().length ? true : null), 6000);
  await sleep(150);

  const rows = collectAddressRows();
  let match = rows.find((row) => textOf(row).includes(keyword)) || null;

  // Fallback: a looser text search across clickable elements.
  if (!match) {
    match = findByText(keyword, { selector: ADDRESS_ROW_SELECTOR });
  }
  if (!match) {
    return { success: false, detail: `no address matching "${keyword}" (${rows.length} rows)` };
  }

  // Click an inner radio/select control if present, else the row itself.
  const selectable =
    match.querySelector<HTMLElement>(
      '[class*="radio"], [class*="check"], [class*="select"], input[type="radio"]',
    ) || match;
  const clicked = clickEl(isVisible(selectable) ? selectable : match);
  sendDdEvent('addressSelected', { keyword, matched: textOf(match).slice(0, 80) });
  return {
    success: clicked,
    detail: clicked ? `selected address for "${keyword}"` : 'address click failed',
    matched: textOf(match).slice(0, 120),
  };
}

export default defineContentScript({
  matches: [
    'https://mobile.yangkeduo.com/order_checkout.html*',
    'https://mobile.yangkeduo.com/addresses.html*',
  ],
  runAt: 'document_start',
  allFrames: true,
  main() {
    onAction({ selectAddress });

    void domReady().then(() => {
      sendDdEvent('addressPageReady', { rows: collectAddressRows().length });
    });
  },
});

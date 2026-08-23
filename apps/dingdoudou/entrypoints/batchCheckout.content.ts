// Batch-checkout automation for Pinduoduo's transac_batch_checkout page.
// Ported from the original DDK transacBatchCheckoutAutomation script.
//
// Action 'startBatchCheckout' { count? } walks the checkout rows top-to-bottom
// and clicks each row's place-order / pay control one at a time, pausing between
// rows and emitting { ddEvent:'batchCheckoutProgress', index, total, done }.
//
// Runs at document_end (also injected on addresses.html per the original
// manifest, where it simply stays idle).

import {
  clickEl,
  domReady,
  isVisible,
  onAction,
  queryAll,
  sendDdEvent,
  sleep,
  textOf,
  waitFor,
  type AutomationContext,
  type ActionMessage,
  type ActionResult,
} from '@/lib/domAuto';

// Per-row place-order / pay controls (best-effort heuristics).
const ROW_BUTTON_TEXT = /(立即支付|提交订单|去支付|确认下单|下单|付款|去结算|结算)/;
const ROW_BUTTON_SELECTOR = [
  '[class*="checkout"] button',
  '[class*="submit"]',
  '[class*="pay"]',
  '[class*="order-btn"]',
  '[class*="place-order"]',
  'button',
  '[role="button"]',
].join(',');

// Only meaningful on the batch-checkout page.
function onBatchPage(): boolean {
  try {
    return location.pathname.includes('transac_batch_checkout');
  } catch {
    return false;
  }
}

// Collect the distinct place-order buttons currently rendered, de-duplicated.
function collectRowButtons(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new Set<Element>();
  for (const el of queryAll<HTMLElement>(ROW_BUTTON_SELECTOR)) {
    if (seen.has(el) || !isVisible(el)) continue;
    const t = textOf(el);
    if (!t || !ROW_BUTTON_TEXT.test(t) || t.length > 12) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

async function startBatchCheckout(
  msg: ActionMessage,
  ctx: AutomationContext,
): Promise<ActionResult> {
  if (!onBatchPage()) {
    return { success: false, detail: 'not on batch-checkout page' };
  }

  await waitFor(() => (collectRowButtons().length ? true : null), 6000, 200, ctx);
  const buttons = collectRowButtons();
  const requested = Number(msg.count);
  const total =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, buttons.length)
      : buttons.length;

  if (!total) {
    sendDdEvent('batchCheckoutProgress', { index: 0, total: 0, done: true });
    return { success: false, detail: 'no place-order controls found' };
  }

  // Snapshot the buttons once so each distinct row is clicked at most once;
  // skip any that get detached as the list re-renders between clicks.
  let done = 0;
  for (let i = 0; i < total; i++) {
    const btn = buttons[i];
    const live = btn && btn.isConnected && isVisible(btn);
    const clicked = live ? clickEl(btn) : false;
    if (clicked) done++;
    sendDdEvent('batchCheckoutProgress', {
      index: i + 1,
      total,
      done: i + 1 >= total,
      clicked,
      skipped: !live,
    });
    // Pace the clicks so each navigation/render settles before the next row.
    await sleep(1200, ctx);
  }

  return {
    success: done > 0,
    detail: `clicked ${done}/${total} checkout rows`,
    clicked: done,
    total,
  };
}

export default defineContentScript({
  matches: [
    'https://mobile.yangkeduo.com/transac_batch_checkout.html*',
    'https://mobile.yangkeduo.com/addresses.html*',
  ],
  runAt: 'document_end',
  main(ctx) {
    onAction(ctx, { startBatchCheckout: (message) => startBatchCheckout(message, ctx) });

    if (onBatchPage()) {
      void domReady(8000, ctx).then(() =>
        sendDdEvent('batchCheckoutReady', { rows: collectRowButtons().length }),
      );
    }
  },
});

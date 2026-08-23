// Payment / checkout automation for Pinduoduo order pages and the Alipay
// cashier. Ported from the original DDK paymentAutomation script.
//
// The background drives this script with simple { action } messages and reads
// the { success, detail } reply. Each step is independent and best-effort: it
// resolves with success:false rather than throwing so the orchestration loop on
// the background side can decide whether to retry, reload, or move on.
//
// Runs at document_start in all frames (the Alipay cashier is iframed).

import {
  clickEl,
  domReady,
  findByText,
  isVisible,
  onAction,
  query,
  queryAll,
  sendDdEvent,
  toast,
  typeDigits,
  waitFor,
  type AutomationContext,
  type ActionMessage,
  type ActionResult,
} from '@/lib/domAuto';

// --- selector / text heuristics (best-effort) -----------------------------

// "Pay now" style primary buttons. PDD renders these as styled <div>s, often
// with data-active="red" or a pay-confirm-btn class; we also match by text.
const PAY_SELECTORS = [
  'div[data-active="red"]',
  'div.pay-confirm-btn',
  '.pay-confirm-btn',
  'button[type="submit"]',
].join(',');
const PAY_TEXT = /(立即支付|去支付|确认支付|提交订单|确认下单|去付款|马上支付)/;

// Confirm-payment buttons shown on the cashier confirmation step.
const CONFIRM_TEXT = /(确认付款|确认支付|确定支付|立即付款|确定|确认)/;

// "Next order" controls used when paying a queue of orders one by one.
const NEXT_TEXT = /(下一步|下一单|继续支付|支付下一单|继续|下一个)/;

// Segmented passcode cells (PDD/Alipay PIN) and plain password inputs.
const PASSCODE_CELL_SELECTOR =
  '.my-passcode-input-cell, [class*="passcode"] input, [class*="pwd"] input';
const PASSWORD_INPUT_SELECTOR =
  'input[type="password"], input[inputmode="numeric"][maxlength], input[type="tel"][maxlength]';

// Payment result indicators.
const SUCCESS_TEXT = /(支付成功|付款成功|交易成功|已支付)/;
const FAILURE_TEXT = /(支付失败|付款失败|交易关闭|订单已关闭|支付超时|交易失败)/;

// --- step detection -------------------------------------------------------

type PaymentStep =
  | 'checkout'
  | 'password'
  | 'confirm'
  | 'result-success'
  | 'result-failure'
  | 'unknown';

function detectStep(): PaymentStep {
  let bodyText = '';
  try {
    bodyText = document.body?.innerText || '';
  } catch {
    /* ignore */
  }
  if (SUCCESS_TEXT.test(bodyText)) return 'result-success';
  if (FAILURE_TEXT.test(bodyText)) return 'result-failure';
  if (query(PASSCODE_CELL_SELECTOR) || query(PASSWORD_INPUT_SELECTOR)) return 'password';
  if (findByText(CONFIRM_TEXT)) return 'confirm';
  if (findByText(PAY_TEXT) || query(PAY_SELECTORS)) return 'checkout';
  return 'unknown';
}

// --- action implementations -----------------------------------------------

async function clickPayButton(ctx: AutomationContext): Promise<ActionResult> {
  // Prefer a stable selector match, then fall back to visible text.
  const bySelector = queryAll<HTMLElement>(PAY_SELECTORS).find(isVisible);
  const target =
    bySelector ||
    (await waitFor(() => findByText(PAY_TEXT), 6000, 200, ctx)) ||
    findByText(PAY_TEXT, { selector: 'div, button, a, span' });
  if (!target) return { success: false, detail: 'pay button not found' };
  const clicked = clickEl(target);
  sendDdEvent('paymentStep', { step: 'pay-clicked' });
  return { success: clicked, detail: clicked ? 'pay button clicked' : 'pay click failed' };
}

async function inputPaymentPassword(
  msg: ActionMessage,
  ctx: AutomationContext,
): Promise<ActionResult> {
  // The password is supplied by the background (never stored in this script).
  const password = String(
    (msg.password as string) ?? (msg.digits as string) ?? (msg.value as string) ?? '',
  ).replace(/\s+/g, '');
  if (!password) return { success: false, detail: 'no password provided' };

  // Wait for the passcode UI to mount (it animates in after the pay click).
  await waitFor(
    () => query(PASSCODE_CELL_SELECTOR) || query(PASSWORD_INPUT_SELECTOR),
    6000,
    200,
    ctx,
  );

  // Case 1: a single password/PIN input.
  const single = query<HTMLInputElement>(PASSWORD_INPUT_SELECTOR);
  if (single && isVisible(single)) {
    const ok = typeDigits(single, password);
    sendDdEvent('paymentStep', { step: 'password-entered' });
    return { success: ok, detail: ok ? 'password entered (input)' : 'password entry failed' };
  }

  // Case 2: segmented passcode cells — focus the field then type each digit.
  const cells = queryAll<HTMLElement>(PASSCODE_CELL_SELECTOR).filter(isVisible);
  if (cells.length) {
    const hidden = query<HTMLInputElement>('input[type="password"], input[type="tel"]');
    const sink = hidden || cells[0];
    const ok = typeDigits(sink, password);
    sendDdEvent('paymentStep', { step: 'password-entered' });
    return {
      success: ok,
      detail: ok ? `password entered (${cells.length} cells)` : 'passcode entry failed',
    };
  }

  return { success: false, detail: 'password field not found' };
}

async function clickConfirmPayment(ctx: AutomationContext): Promise<ActionResult> {
  const target =
    (await waitFor(() => findByText(CONFIRM_TEXT), 6000, 200, ctx)) ||
    query<HTMLElement>('div.pay-confirm-btn, .pay-confirm-btn');
  if (!target) return { success: false, detail: 'confirm button not found' };
  const clicked = clickEl(target);
  sendDdEvent('paymentStep', { step: 'confirm-clicked' });
  return { success: clicked, detail: clicked ? 'confirm clicked' : 'confirm click failed' };
}

async function proceedToNextOrder(ctx: AutomationContext): Promise<ActionResult> {
  const target = await waitFor(() => findByText(NEXT_TEXT), 4000, 200, ctx);
  if (!target) {
    // Not finding a "next" control is a valid terminal state, not an error.
    sendDdEvent('paymentStep', { step: 'no-next' });
    return { success: false, detail: 'no next-order control on page' };
  }
  const clicked = clickEl(target);
  sendDdEvent('paymentStep', { step: 'next-clicked' });
  return { success: clicked, detail: clicked ? 'proceeding to next order' : 'next click failed' };
}

function updatePaymentStep(msg: ActionMessage): ActionResult {
  // Re-detect the on-page step and report it back. An optional msg.step lets the
  // background annotate what it believes the step should be.
  const detected = detectStep();
  sendDdEvent('paymentStep', { step: detected, expected: msg.step ?? null });
  return { success: true, detail: `step=${detected}`, step: detected };
}

function showAlert(msg: ActionMessage, ctx: AutomationContext): ActionResult {
  const message = String((msg.message as string) ?? (msg.text as string) ?? '');
  toast(message || 'DingDuoDuo', Number(msg.duration) || 3200, ctx);
  return { success: true, detail: 'alert shown' };
}

function reloadPage(ctx: AutomationContext): ActionResult {
  // Reply first, then reload on the next tick so the response is delivered.
  ctx.setTimeout(() => {
    try {
      location.reload();
    } catch {
      /* ignore */
    }
  }, 50);
  return { success: true, detail: 'reloading' };
}

export default defineContentScript({
  matches: [
    'https://mobile.yangkeduo.com/order.html*',
    'https://mobile.yangkeduo.com/order_checkout.html*',
    'https://mobile.yangkeduo.com/transac_combine_order.html*',
    'https://mobile.yangkeduo.com/transac_orders_search_results.html*',
    'https://mclient.alipay.com/h5pay/*',
  ],
  runAt: 'document_start',
  allFrames: true,
  main(ctx) {
    onAction(ctx, {
      clickPayButton: () => clickPayButton(ctx),
      inputPaymentPassword: (message) => inputPaymentPassword(message, ctx),
      clickConfirmPayment: () => clickConfirmPayment(ctx),
      proceedToNextOrder: () => proceedToNextOrder(ctx),
      updatePaymentStep,
      showAlert: (message) => showAlert(message, ctx),
      reload: () => reloadPage(ctx),
    });

    // Proactively report the detected step once the page is ready and whenever
    // a result phrase appears, so the background can advance its state machine.
    void domReady(8000, ctx).then(() => {
      const report = () => sendDdEvent('paymentStep', { step: detectStep() });
      report();
      ctx.setTimeout(report, 1200);

      // Watch for late-arriving result text only (a cheap body-text scan,
      // debounced) — full step detection runs on demand via updatePaymentStep.
      try {
        let reported = false;
        let scheduled = false;
        const scan = () => {
          scheduled = false;
          if (reported) return;
          let text = '';
          try {
            text = document.body?.innerText || '';
          } catch {
            return;
          }
          if (SUCCESS_TEXT.test(text)) {
            reported = true;
            sendDdEvent('paymentStep', { step: 'result-success' });
          } else if (FAILURE_TEXT.test(text)) {
            reported = true;
            sendDdEvent('paymentStep', { step: 'result-failure' });
          }
        };
        const observer = new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          ctx.setTimeout(scan, 300);
        });
        const target = document.body || document.documentElement;
        if (target) {
          observer.observe(target, { childList: true, subtree: true });
          ctx.onInvalidated(() => observer.disconnect());
        }
      } catch {
        /* observer is an optimization only */
      }
    });
  },
});

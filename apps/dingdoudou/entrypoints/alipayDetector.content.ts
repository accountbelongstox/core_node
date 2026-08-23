// Alipay cashier detector. Ported from the original DDK alipayDetector
// script. Observes the Alipay H5 cashier (mclient.alipay.com/h5pay/*) and
// reports its lifecycle to the background as { ddEvent:'alipayResult', status }.
//
// Statuses: 'detected' (a cashier/login page is present), 'login' (needs
// Alipay sign-in), 'success', 'failure', 'pending'. Runs at document_start in
// all frames because the cashier is frequently iframed.

import { onAction, sendDdEvent, type ActionResult } from '@/lib/domAuto';

type AlipayStatus = 'detected' | 'login' | 'success' | 'failure' | 'pending' | 'none';

const SUCCESS_TEXT = /(支付成功|付款成功|交易成功|已完成支付)/;
const FAILURE_TEXT = /(支付失败|付款失败|交易关闭|交易失败|订单已关闭|支付超时|已取消)/;
const LOGIN_TEXT = /(请登录支付宝账户|登录支付宝|账户登录|登录后付款)/;
const CASHIER_TEXT = /(确认付款|收银台|扫码支付|确认支付|付款方式)/;

function readBodyText(): string {
  try {
    return document.body?.innerText || '';
  } catch {
    return '';
  }
}

// Is this recognizably an Alipay page at all (host / title / DOM markers)?
function isAlipayPage(): boolean {
  try {
    if (location.hostname === 'mclient.alipay.com') return true;
  } catch {
    /* ignore */
  }
  const title = (() => {
    try {
      return document.title || '';
    } catch {
      return '';
    }
  })();
  if (/(支付宝|alipay|统一收银台)/i.test(title)) return true;
  try {
    if (
      document.querySelector('[class*="alipay"], [id*="alipay"], [class*="ant-"], [class*="cashier"]')
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// Classify the current cashier state. Result phrases win over login/cashier.
function detectStatus(): AlipayStatus {
  const text = readBodyText();
  if (SUCCESS_TEXT.test(text)) return 'success';
  if (FAILURE_TEXT.test(text)) return 'failure';
  let path = '';
  try {
    path = location.pathname || '';
  } catch {
    /* ignore */
  }
  if (LOGIN_TEXT.test(text) || path.includes('/h5pay/unifiedLogin/')) return 'login';
  if (CASHIER_TEXT.test(text)) return 'pending';
  if (isAlipayPage()) return 'detected';
  return 'none';
}

export default defineContentScript({
  matches: ['https://mclient.alipay.com/h5pay/*'],
  runAt: 'document_start',
  allFrames: true,
  main(ctx) {
    // Allow the background to ask for the current status on demand.
    onAction(ctx, {
      detectAlipayStatus(): ActionResult {
        const status = detectStatus();
        return { success: true, detail: `status=${status}`, status };
      },
    });

    let lastStatus: AlipayStatus = 'none';
    let lastUrl = (() => {
      try {
        return location.href;
      } catch {
        return '';
      }
    })();

    const report = (force = false) => {
      const status = detectStatus();
      if (status === 'none') return;
      if (!force && status === lastStatus) return;
      lastStatus = status;
      sendDdEvent('alipayResult', { status });
    };

    // Initial sweep with staggered retries — the cashier hydrates lazily.
    const kick = () => {
      report(true);
      [400, 1000, 2000, 3500, 6000].forEach((delay) =>
        ctx.setTimeout(() => report(), delay),
      );
    };
    if (document.readyState === 'loading') {
      ctx.addEventListener(document, 'DOMContentLoaded', kick, { once: true });
    } else {
      kick();
    }

    // Watch DOM mutations for late-arriving success/failure text.
    const startObserver = () => {
      try {
        const observer = new MutationObserver(() => report());
        const target = document.body || document.documentElement;
        if (target) {
          observer.observe(target, { childList: true, subtree: true, characterData: true });
          ctx.onInvalidated(() => observer.disconnect());
        }
      } catch {
        /* polling below still covers it */
      }
    };
    if (document.body) startObserver();
    else ctx.setTimeout(startObserver, 800);

    // SPA URL changes (e.g. unifiedLogin → result) don't always trigger
    // mutations on our root, so poll the URL as a backstop.
    ctx.setInterval(() => {
      let href = '';
      try {
        href = location.href;
      } catch {
        return;
      }
      if (href !== lastUrl) {
        lastUrl = href;
        report(true);
      } else {
        report();
      }
    }, 600);
  },
});

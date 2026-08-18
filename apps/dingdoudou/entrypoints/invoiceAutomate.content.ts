// Invoice automation for Pinduoduo's "modify invoice" page. Ported from the
// original DDK invoiceAutomate script.
//
// Action 'applyInvoice' { title?, taxNo? } fills the invoice title and (for a
// company / VAT invoice) the tax number, then submits the form. Everything is
// matched by nearby label / placeholder text because the inputs have no stable
// ids. Runs at document_idle.

import {
  clickEl,
  domReady,
  findByText,
  isVisible,
  onAction,
  query,
  queryAll,
  sendDdEvent,
  setInputValue,
  sleep,
  textOf,
  waitFor,
  type ActionMessage,
  type ActionResult,
} from '@/lib/domAuto';

const SUBMIT_TEXT = /(提交|保存|确认|确定|开具发票|申请开票)/;

// Find a text/number input by matching its placeholder, or the label text of
// the field group it belongs to. Best-effort.
function findFieldInput(patterns: RegExp): HTMLInputElement | null {
  const inputs = queryAll<HTMLInputElement>(
    'input[type="text"], input:not([type]), input[type="tel"], textarea',
  ).filter(isVisible);

  // 1) placeholder match
  for (const el of inputs) {
    const ph = el.getAttribute('placeholder') || '';
    if (ph && patterns.test(ph)) return el;
  }
  // 2) sibling/ancestor label text match
  for (const el of inputs) {
    let node: HTMLElement | null = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const label = textOf(node);
      if (label && patterns.test(label) && label.length < 60) return el;
    }
  }
  return null;
}

async function applyInvoice(msg: ActionMessage): Promise<ActionResult> {
  const title = msg.title != null ? String(msg.title) : '';
  const taxNo = msg.taxNo != null ? String(msg.taxNo) : '';

  // Wait for the form to be present.
  await waitFor(
    () => query('input[type="text"], input[type="tel"], textarea, input:not([type])'),
    6000,
  );

  const filled: string[] = [];

  if (title) {
    const titleInput = findFieldInput(/(发票抬头|抬头|单位名称|公司名称|名称)/);
    if (titleInput && setInputValue(titleInput, title)) filled.push('title');
  }

  if (taxNo) {
    // A tax number usually only appears after choosing the "企业" (company)
    // invoice type — tap that toggle first if it exists.
    const companyToggle = findByText(/(企业|公司|单位)/, {
      selector: '[class*="tab"], [class*="type"], [role="tab"], button, span, div, li',
    });
    if (companyToggle && isVisible(companyToggle)) {
      clickEl(companyToggle);
      await sleep(200);
    }
    const taxInput = findFieldInput(/(税号|纳税人识别号|统一社会信用代码)/);
    if (taxInput && setInputValue(taxInput, taxNo)) filled.push('taxNo');
  }

  // Submit.
  const submit = await waitFor(() => findByText(SUBMIT_TEXT), 3000);
  let submitted = false;
  if (submit) submitted = clickEl(submit);

  sendDdEvent('invoiceApplied', { filled, submitted });
  return {
    success: submitted || filled.length > 0,
    detail: `filled=[${filled.join(',')}] submitted=${submitted}`,
    filled,
    submitted,
  };
}

export default defineContentScript({
  matches: ['https://mobile.yangkeduo.com/transac_modify_invoice.html*'],
  runAt: 'document_idle',
  main() {
    onAction({ applyInvoice });

    void domReady().then(() => sendDdEvent('invoicePageReady', { href: location.href }));
  },
});

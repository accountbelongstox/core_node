/** XML validation, pretty printing, minifying and XPath evaluation on top of DOMParser. */

export type XmlAttrWrap = 'never' | 'long' | 'always';

export interface XmlFormatOptions {
  indent: 2 | 4 | 'tab';
  minify: boolean;
  attrWrap: XmlAttrWrap;
}

export interface XmlStats {
  elements: number;
  attributes: number;
  depth: number;
}

export interface XmlParseFailure {
  empty: boolean;
  message: string;
  line: number | null;
  column: number | null;
}

export type XmlFormatResult = { ok: true; output: string; stats: XmlStats } | { ok: false; error: XmlParseFailure };

export interface XPathItem {
  kind: 'element' | 'attribute' | 'text' | 'comment' | 'other';
  preview: string;
}

export type XPathResultView = { ok: true; items: XPathItem[]; scalar: string | null } | { ok: false; message: string };

const LONG_TAG = 100;
const PREVIEW_LIMIT = 240;
const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const PI = 7;
const COMMENT = 8;
const ERROR_LINE = /line (\d+)(?: at)? column (\d+)/i;
const ERROR_LINE_FIREFOX = /Line Number (\d+), Column (\d+)/i;

export function parseXml(source: string): { doc: Document } | { error: XmlParseFailure } {
  if (!source.trim()) return { error: { empty: true, message: '', line: null, column: null } };
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const failure = doc.getElementsByTagName('parsererror')[0];
  if (!failure) return { doc };
  const text = failure.textContent ?? '';
  const where = ERROR_LINE.exec(text) ?? ERROR_LINE_FIREFOX.exec(text);
  const detail = /error on line \d+ at column \d+:\s*([^\n]+)/i.exec(text)?.[1] ?? /XML Parsing Error:\s*([^\n]+)/i.exec(text)?.[1] ?? text.split('\n')[0];
  return { error: { empty: false, message: detail.replace(/Below is a rendering.*$/is, '').trim(), line: where ? Number(where[1]) : null, column: where ? Number(where[2]) : null } };
}

const escapeText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');

const isBlankText = (node: Node): boolean => node.nodeType === TEXT && !(node.nodeValue ?? '').trim();

const hasContentText = (el: Element): boolean => Array.from(el.childNodes).some((node) => (node.nodeType === TEXT && (node.nodeValue ?? '').trim()) || node.nodeType === CDATA);

const inlineNode = (node: Node): string => {
  switch (node.nodeType) {
    case ELEMENT: return inlineElement(node as Element);
    case TEXT: return escapeText(node.nodeValue ?? '');
    case CDATA: return `<![CDATA[${node.nodeValue ?? ''}]]>`;
    case COMMENT: return `<!--${node.nodeValue ?? ''}-->`;
    case PI: return `<?${(node as ProcessingInstruction).target} ${node.nodeValue ?? ''}?>`.replace(' ?>', '?>');
    default: return '';
  }
};

const attributeList = (el: Element): string[] => Array.from(el.attributes).map((attr) => `${attr.name}="${escapeAttr(attr.value)}"`);

function inlineElement(el: Element): string {
  const attrs = attributeList(el);
  const open = `<${el.tagName}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
  if (!el.childNodes.length) return `${open}/>`;
  return `${open}>${Array.from(el.childNodes).map(inlineNode).join('')}</${el.tagName}>`;
}

const xmlStats = (doc: Document): XmlStats => {
  const all = Array.from(doc.getElementsByTagName('*'));
  const depthOf = (el: Element): number => {
    let depth = 0;
    for (let node: Element | null = el; node; node = node.parentElement) depth++;
    return depth;
  };
  return { elements: all.length, attributes: all.reduce((sum, el) => sum + el.attributes.length, 0), depth: all.reduce((max, el) => Math.max(max, depthOf(el)), 0) };
};

const sourceMatch = (source: string, pattern: RegExp): string | null => pattern.exec(source)?.[0].trim() ?? null;

export function formatXml(source: string, options: XmlFormatOptions): XmlFormatResult {
  const parsed = parseXml(source);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const unit = options.indent === 'tab' ? '\t' : ' '.repeat(options.indent);
  const lines: string[] = [];

  const write = (level: number, text: string): void => {
    lines.push(options.minify ? text : `${unit.repeat(level)}${text}`);
  };

  const writeOpen = (el: Element, level: number, selfClose: boolean, trailing = ''): void => {
    const attrs = attributeList(el);
    const close = selfClose ? '/>' : '>';
    const single = `<${el.tagName}${attrs.length ? ` ${attrs.join(' ')}` : ''}${close}`;
    const wrap = !options.minify && attrs.length > 1 && (options.attrWrap === 'always' || (options.attrWrap === 'long' && unit.length * level + single.length > LONG_TAG));
    if (!wrap) {
      write(level, single + trailing);
      return;
    }
    write(level, `<${el.tagName}`);
    attrs.forEach((attr) => write(level + 1, attr));
    lines[lines.length - 1] += close + trailing;
  };

  const walk = (el: Element, level: number): void => {
    const children = Array.from(el.childNodes);
    if (!children.length) {
      writeOpen(el, level, true);
      return;
    }
    const elementChildren = children.some((node) => node.nodeType === ELEMENT);
    const mixed = elementChildren && hasContentText(el);
    if (mixed) {
      writeOpen(el, level, false, children.map(inlineNode).join('') + `</${el.tagName}>`);
      return;
    }
    if (!elementChildren) {
      const text = children.map(inlineNode).join('');
      const hasMarkup = children.some((node) => node.nodeType !== TEXT);
      const body = options.minify || hasMarkup ? text : escapeText((el.textContent ?? '').trim());
      if (!body.trim() && !hasMarkup && !options.minify) {
        writeOpen(el, level, true);
        return;
      }
      writeOpen(el, level, false, `${body}</${el.tagName}>`);
      return;
    }
    writeOpen(el, level, false);
    children.forEach((node) => {
      if (isBlankText(node)) return;
      if (node.nodeType === ELEMENT) walk(node as Element, level + 1);
      else write(level + 1, inlineNode(node));
    });
    write(level, `</${el.tagName}>`);
  };

  const declaration = sourceMatch(source, /^\s*<\?xml[\s\S]*?\?>/);
  if (declaration) write(0, declaration);
  const doctype = sourceMatch(source, /<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/i);
  const { doc } = parsed;
  if (doctype) write(0, doctype);
  Array.from(doc.childNodes).forEach((node) => {
    if (node.nodeType === ELEMENT) walk(node as Element, 0);
    else if (node.nodeType === COMMENT || node.nodeType === PI) {
      if (!(node.nodeType === PI && (node as ProcessingInstruction).target === 'xml')) write(0, inlineNode(node));
    }
  });
  return { ok: true, output: lines.join(options.minify ? '' : '\n'), stats: xmlStats(doc) };
}

const preview = (text: string): string => (text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}...` : text);

const nodeKind = (node: Node): XPathItem['kind'] => {
  if (node.nodeType === ELEMENT) return 'element';
  if (node.nodeType === 2) return 'attribute';
  if (node.nodeType === TEXT || node.nodeType === CDATA) return 'text';
  if (node.nodeType === COMMENT) return 'comment';
  return 'other';
};

const nodePreview = (node: Node): string => {
  if (node.nodeType === ELEMENT) return preview(inlineElement(node as Element));
  if (node.nodeType === 2) return `${(node as Attr).name}="${(node as Attr).value}"`;
  return preview(node.nodeValue ?? node.textContent ?? '');
};

export function evaluateXPath(source: string, expression: string): XPathResultView {
  const parsed = parseXml(source);
  if ('error' in parsed) return { ok: false, message: parsed.error.message };
  const { doc } = parsed;
  try {
    const result = doc.evaluate(expression, doc, (prefix) => (prefix ? doc.documentElement.lookupNamespaceURI(prefix) : null), XPathResult.ANY_TYPE, null);
    if (result.resultType === XPathResult.NUMBER_TYPE) return { ok: true, items: [], scalar: String(result.numberValue) };
    if (result.resultType === XPathResult.STRING_TYPE) return { ok: true, items: [], scalar: result.stringValue };
    if (result.resultType === XPathResult.BOOLEAN_TYPE) return { ok: true, items: [], scalar: String(result.booleanValue) };
    const items: XPathItem[] = [];
    for (let node = result.iterateNext(); node; node = result.iterateNext()) items.push({ kind: nodeKind(node), preview: nodePreview(node) });
    return { ok: true, items, scalar: null };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

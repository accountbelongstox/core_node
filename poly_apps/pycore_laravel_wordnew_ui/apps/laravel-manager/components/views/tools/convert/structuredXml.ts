/** XML <-> JSON value mapping (attributes as "@name", mixed text as "#text", repeated elements as arrays) via DOMParser. */
import { ConvertError } from './convertCodecs';
import type { JsonValue } from './structuredYaml';

type JsonObject = { [key: string]: JsonValue };

const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const ROOT_NAME = 'root';
const ITEM_NAME = 'item';

const typedScalar = (text: string, typed: boolean): JsonValue => {
  if (!typed) return text;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (NUMERIC.test(text) && String(Number(text)) === text) return Number(text);
  return text;
};

const elementToValue = (element: Element, typed: boolean): JsonValue => {
  const out: JsonObject = {};
  Array.from(element.attributes).forEach((attr) => {
    out[`@${attr.name}`] = typedScalar(attr.value, typed);
  });
  let text = '';
  const children: Element[] = [];
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === 1) children.push(node as Element);
    else if (node.nodeType === 3 || node.nodeType === 4) text += node.nodeValue ?? '';
  });
  children.forEach((child) => {
    const value = elementToValue(child, typed);
    const existing = out[child.nodeName];
    if (existing === undefined) out[child.nodeName] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[child.nodeName] = [existing, value];
  });
  const trimmed = text.trim();
  if (Object.keys(out).length === 0) return trimmed === '' ? null : typedScalar(trimmed, typed);
  if (trimmed !== '') out['#text'] = typedScalar(trimmed, typed);
  return out;
};

export const parseXml = (text: string, typed: boolean): JsonValue => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const failure = doc.getElementsByTagName('parsererror')[0];
  if (failure || !doc.documentElement) throw new ConvertError('xml_invalid', (failure?.textContent ?? '').trim().split('\n')[0]);
  return { [doc.documentElement.nodeName]: elementToValue(doc.documentElement, typed) };
};

const escapeXml = (value: string): string => value.replace(/[&<>"]/g, (ch) => XML_ESCAPES[ch]);

const xmlName = (raw: string): string => {
  const clean = raw.replace(/[^\p{L}\p{N}_.-]/gu, '_');
  return /^[\p{L}_]/u.test(clean) ? clean : `_${clean}`;
};

const scalarText = (value: JsonValue): string => (value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));

const isObject = (value: JsonValue): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

const renderElement = (name: string, value: JsonValue, level: number, unit: string, out: string[]): void => {
  const pad = unit.repeat(level);
  const tag = xmlName(name);
  if (Array.isArray(value)) {
    value.forEach((item) => renderElement(name, item, level, unit, out));
    return;
  }
  if (!isObject(value)) {
    const text = scalarText(value);
    out.push(value === null || text === '' ? `${pad}<${tag}/>` : `${pad}<${tag}>${escapeXml(text)}</${tag}>`);
    return;
  }
  const entries = Object.entries(value);
  const attrs = entries.filter(([key]) => key.startsWith('@')).map(([key, v]) => ` ${xmlName(key.slice(1))}="${escapeXml(scalarText(v))}"`).join('');
  const text = value['#text'] === undefined ? '' : escapeXml(scalarText(value['#text']));
  const children = entries.filter(([key]) => !key.startsWith('@') && key !== '#text');
  if (children.length === 0) {
    out.push(text === '' ? `${pad}<${tag}${attrs}/>` : `${pad}<${tag}${attrs}>${text}</${tag}>`);
    return;
  }
  out.push(`${pad}<${tag}${attrs}>`);
  if (text !== '') out.push(`${pad}${unit}${text}`);
  children.forEach(([key, child]) => renderElement(key, child, level + 1, unit, out));
  out.push(`${pad}</${tag}>`);
};

export const stringifyXml = (value: JsonValue, unit: string): string => {
  let rootName = ROOT_NAME;
  let rootValue: JsonValue = value;
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && !keys[0].startsWith('@') && keys[0] !== '#text' && !Array.isArray(value[keys[0]])) {
      rootName = keys[0];
      rootValue = value[keys[0]];
    }
  } else if (Array.isArray(value)) rootValue = { [ITEM_NAME]: value };
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  renderElement(rootName, rootValue, 0, unit, lines);
  return `${lines.join('\n')}\n`;
};

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { extension as getExtensionFromMimeType, extension as getMimeTypeFromExtension } from 'mime-types';
import type { Ref } from 'vue';
import _ from 'lodash';

export {
  getMimeTypeFromBase64,
  getMimeTypeFromExtension, getExtensionFromMimeType,
  useDownloadFileFromBase64, useDownloadFileFromBase64Refs,
  previewImageFromBase64,
};

const commonMimeTypesSignatures = {
  'JVBERi0': 'application/pdf',
  'R0lGODdh': 'image/gif',
  'R0lGODlh': 'image/gif',
  'iVBORw0KGgo': 'image/png',
  '/9j/': 'image/jpg',
};

function getMimeTypeFromBase64({ base64String }: { base64String: string }) {
  const [,mimeTypeFromBase64] = base64String.match(/data:(.*?);base64/i) ?? [];

  if (mimeTypeFromBase64) {
    return { mimeType: mimeTypeFromBase64 };
  }

  const inferredMimeType = _.find(commonMimeTypesSignatures, (_mimeType, signature) => base64String.startsWith(signature));

  if (inferredMimeType) {
    return { mimeType: inferredMimeType };
  }

  return { mimeType: undefined };
}

function getFileExtensionFromMimeType({
  mimeType,
  defaultExtension = 'txt',
}: {
  mimeType: string | undefined
  defaultExtension?: string
}) {
  if (mimeType) {
    return getExtensionFromMimeType(mimeType) ?? defaultExtension;
  }

  return defaultExtension;
}

function downloadFromBase64({ sourceValue, filename, extension, fileMimeType }:
{ sourceValue: string; filename?: string; extension?: string; fileMimeType?: string }) {
  if (sourceValue === '') {
    throw new Error('Base64 string is empty');
  }

  const defaultExtension = extension ?? 'txt';
  const { mimeType } = getMimeTypeFromBase64({ base64String: sourceValue });
  let base64String = sourceValue;
  if (!mimeType) {
    const targetMimeType = fileMimeType ?? getMimeTypeFromExtension(defaultExtension);
    base64String = `data:${targetMimeType};base64,${sourceValue}`;
  }

  const cleanExtension = extension ?? getFileExtensionFromMimeType(
    { mimeType, defaultExtension });
  let cleanFileName = filename ?? `file.${cleanExtension}`;
  if (extension && !cleanFileName.endsWith(`.${extension}`)) {
    cleanFileName = `${cleanFileName}.${cleanExtension}`;
  }

  const a = document.createElement('a');
  a.href = base64String;
  a.download = cleanFileName;
  a.click();
}

function useDownloadFileFromBase64(
  { source, filename, extension, fileMimeType }:
  { source: Ref<string>; filename?: string; extension?: string; fileMimeType?: string }) {
  return {
    download() {
      downloadFromBase64({ sourceValue: source.value, filename, extension, fileMimeType });
    },
  };
}

function useDownloadFileFromBase64Refs(
  { source, filename, extension }:
  { source: Ref<string>; filename?: Ref<string>; extension?: Ref<string> }) {
  return {
    download() {
      downloadFromBase64({ sourceValue: source.value, filename: filename?.value, extension: extension?.value });
    },
  };
}

function previewImageFromBase64(base64String: string): HTMLImageElement {
  if (base64String === '') {
    throw new Error('Base64 string is empty');
  }

  const img = document.createElement('img');
  img.src = base64String;

  const container = document.createElement('div');
  container.appendChild(img);

  const previewContainer = document.getElementById('previewContainer');
  if (previewContainer) {
    previewContainer.innerHTML = '';
    previewContainer.appendChild(container);
  }
  else {
    throw new Error('Preview container element not found');
  }

  return img;
}

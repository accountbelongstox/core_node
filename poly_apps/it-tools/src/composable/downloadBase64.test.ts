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

import { describe, expect, it } from 'vitest';
import { getMimeTypeFromBase64 } from './downloadBase64';

describe('downloadBase64', () => {
  describe('getMimeTypeFromBase64', () => {
    it('when the base64 string has a data URI, it returns the mime type', () => {
      expect(getMimeTypeFromBase64({ base64String: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA' })).to.deep.equal({ mimeType: 'image/png' });
      expect(getMimeTypeFromBase64({ base64String: 'data:image/jpg;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA' })).to.deep.equal({ mimeType: 'image/jpg' });
    });

    it('when the base64 string has no data URI, it try to infer the mime type from the signature', () => {
      // https://en.wikipedia.org/wiki/List_of_file_signatures

      // PNG
      expect(getMimeTypeFromBase64({ base64String: 'iVBORw0KGgoAAAANSUhEUgAAAAUA' })).to.deep.equal({ mimeType: 'image/png' });

      // GIF
      expect(getMimeTypeFromBase64({ base64String: 'R0lGODdh' })).to.deep.equal({ mimeType: 'image/gif' });
      expect(getMimeTypeFromBase64({ base64String: 'R0lGODlh' })).to.deep.equal({ mimeType: 'image/gif' });

      // JPG
      expect(getMimeTypeFromBase64({ base64String: '/9j/' })).to.deep.equal({ mimeType: 'image/jpg' });

      // PDF
      expect(getMimeTypeFromBase64({ base64String: 'JVBERi0' })).to.deep.equal({ mimeType: 'application/pdf' });
    });

    it('when the base64 string has no data URI and no signature, it returns an undefined mimeType', () => {
      expect(getMimeTypeFromBase64({ base64String: 'JVBERi' })).to.deep.equal({ mimeType: undefined });
    });
  });
});

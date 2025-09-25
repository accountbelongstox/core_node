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

import type { OGSchemaType } from '../OGSchemaType.type';

export const article: OGSchemaType = {
  name: 'Article',
  elements: [
    {
      type: 'input',
      label: 'Publishing date',
      key: 'article:published_time',
      placeholder: 'When the article was first published...',
    },
    {
      type: 'input',
      label: 'Modification date',
      key: 'article:modified_time',
      placeholder: 'When the article was last changed...',
    },
    {
      type: 'input',
      label: 'Expiration date',
      key: 'article:expiration_time',
      placeholder: 'When the article is out of date after...',
    },
    { type: 'input', label: 'Author', key: 'article:author', placeholder: 'Writers of the article...' },
    {
      type: 'input',
      label: 'Section',
      key: 'article:section',
      placeholder: 'A high-level section name. E.g. Technology..',
    },
    { type: 'input', label: 'Tag', key: 'article:tag', placeholder: 'Tag words associated with this article...' },
  ],
};

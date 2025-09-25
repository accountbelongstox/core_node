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

export const book: OGSchemaType = {
  name: 'Book',
  elements: [
    { type: 'input', label: 'Author', key: 'book:author', placeholder: 'Who wrote this book...' },
    { type: 'input', label: 'ISBN', key: 'book:isbn', placeholder: 'The International Standard Book Number...' },
    {
      type: 'input',
      label: 'Release date',
      key: 'book:release_date',
      placeholder: 'The date the book was released...',
    },
    { type: 'input', label: 'Tag', key: 'book:tag', placeholder: 'Tag words associated with this book...' },
  ],
};

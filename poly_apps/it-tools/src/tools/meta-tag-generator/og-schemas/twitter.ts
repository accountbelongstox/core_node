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

export const twitter: OGSchemaType = {
  name: 'Twitter',
  elements: [
    {
      type: 'select',
      options: [
        { label: 'Summary', value: 'summary' },
        { label: 'Summary with large image', value: 'summary_large_image' },
        { label: 'Application', value: 'app' },
        { label: 'Player', value: 'player' },
      ],
      label: 'Card type',
      placeholder: 'The Twitter card type...',
      key: 'twitter:card',
    },
    {
      type: 'input',
      label: 'Site account',
      placeholder: 'The name of the Twitter account of the site (ex: @ittoolsdottech)...',
      key: 'twitter:site',
    },
    {
      type: 'input',
      label: 'Creator acc.',
      placeholder: 'The name of the Twitter account of the creator (ex: @cthmsst)...',
      key: 'twitter:creator',
    },
  ],
};

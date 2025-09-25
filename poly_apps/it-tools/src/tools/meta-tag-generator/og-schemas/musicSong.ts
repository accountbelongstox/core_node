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

export const musicSong: OGSchemaType = {
  name: 'Song details',
  elements: [
    { type: 'input', label: 'Duration', placeholder: 'The duration of the song...', key: 'music:duration' },
    { type: 'input', label: 'Album', placeholder: 'The album this song is from...', key: 'music:album' },
    {
      type: 'input',
      label: 'Disc',
      placeholder: 'Which disc of the album this song is on...',
      key: 'music:album:disk',
    },
    { type: 'input', label: 'Track', placeholder: ' Which track this song is...', key: 'music:album:track' },
    {
      type: 'input-multiple',
      label: 'Musician',
      placeholder: 'The musician that made this song...',
      key: 'music:musician',
    },
  ],
};

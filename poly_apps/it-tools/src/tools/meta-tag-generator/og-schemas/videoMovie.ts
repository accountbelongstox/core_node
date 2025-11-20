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

export const videoMovie: OGSchemaType = {
  name: 'Movie details',
  elements: [
    {
      type: 'input-multiple',
      label: 'Actor',
      key: 'video:actor',
      placeholder: 'Name of the actress/actor...',
    },
    // { type: 'input', label: 'Actor role', key: 'video:actor:role', placeholder: 'The role they played...' },
    {
      type: 'input-multiple',
      label: 'Director',
      key: 'video:director',
      placeholder: 'Name of the director...',
    },
    { type: 'input-multiple', label: 'Writer', key: 'video:writer', placeholder: 'Writers of the movie...' },
    { type: 'input', label: 'Duration', key: 'video:duration', placeholder: 'The movie\'s length in seconds...' },
    {
      type: 'input',
      label: 'Release date',
      key: 'video:release_date',
      placeholder: 'The date the movie was released...',
    },
    { type: 'input', label: 'Tag', key: 'video:tag', placeholder: 'Tag words associated with this movie...' },
  ],
};

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

const typeOptions = [
  { label: 'Website', value: 'website' },
  { label: 'Article', value: 'article' },
  { label: 'Book', value: 'book' },
  { label: 'Profile', value: 'profile' },
  {
    type: 'group',
    label: 'Music',
    key: 'Music',
    children: [
      { label: 'Song', value: 'music.song' },
      { label: 'Music album', value: 'music.album' },
      { label: 'Playlist', value: 'music.playlist' },
      { label: 'Radio station', value: 'music.radio_station' },
    ],
  },
  {
    type: 'group',
    label: 'Video',
    key: 'Video',
    children: [
      { label: 'Movie', value: 'video.movie' },
      { label: 'Episode', value: 'video.episode' },
      { label: 'TV show', value: 'video.tv_show' },
      { label: 'Other video', value: 'video.other' },
    ],
  },
];

export const website: OGSchemaType = {
  name: 'General information',
  elements: [
    {
      type: 'select',
      label: 'Page type',
      placeholder: 'Select the type of your website...',
      key: 'type',
      options: typeOptions,
    },
    { type: 'input', label: 'Title', placeholder: 'Enter the title of your website...', key: 'title' },
    {
      type: 'input',
      label: 'Description',
      placeholder: 'Enter the description of your website...',
      key: 'description',
    },
    {
      type: 'input',
      label: 'Page URL',
      placeholder: 'Enter the url of your website...',
      key: 'url',
    },
  ],
};

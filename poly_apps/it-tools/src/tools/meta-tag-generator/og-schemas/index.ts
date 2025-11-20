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

import { article } from './article';
import { book } from './book';
import { musicAlbum } from './musicAlbum';
import { musicPlaylist } from './musicPlaylist';
import { musicRadioStation } from './musicRadioStation';
import { musicSong } from './musicSong';
import { profile } from './profile';
import { videoEpisode } from './videoEpisode';
import { videoMovie } from './videoMovie';
import { videoOther } from './videoOther';
import { videoTVShow } from './videoTVShow';

export * from './image';
export * from './twitter';
export * from './website';

export const ogSchemas: Record<string, OGSchemaType> = {
  'music.song': musicSong,
  'music.album': musicAlbum,
  'music.playlist': musicPlaylist,
  'music.radio_station': musicRadioStation,
  'video.movie': videoMovie,
  'video.episode': videoEpisode,
  'video.tv_show': videoTVShow,
  'video.other': videoOther,
  profile,
  article,
  book,
};

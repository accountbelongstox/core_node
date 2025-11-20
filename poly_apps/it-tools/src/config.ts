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

import { figue } from 'figue';

export const config = figue({
  app: {
    version: {
      doc: 'Application current version',
      format: 'string',
      default: '0.0.0',
      env: 'PACKAGE_VERSION',
    },
    lastCommitSha: {
      doc: 'Application last commit SHA version',
      format: 'string',
      default: '',
      env: 'VITE_VERCEL_GIT_COMMIT_SHA',
    },
    baseUrl: {
      doc: 'Application base url',
      format: 'string',
      default: '/',
      env: 'BASE_URL',
    },
    env: {
      doc: 'Application current env',
      format: 'enum',
      values: ['production', 'development', 'preview', 'test'],
      default: 'development',
      env: 'VITE_VERCEL_ENV',
    },
  },
  plausible: {
    isTrackerEnabled: {
      doc: 'Is the tracker enabled',
      format: 'boolean',
      default: false,
      env: 'VITE_TRACKER_ENABLED',
    },
    domain: {
      doc: 'Plausible current domain',
      format: 'string',
      default: '',
      env: 'VITE_PLAUSIBLE_DOMAIN',
    },
    apiHost: {
      doc: 'Plausible remote api host',
      format: 'string',
      default: '',
      env: 'VITE_PLAUSIBLE_API_HOST',
    },
    trackLocalhost: {
      doc: 'Enable or disable localhost tracking by plausible',
      format: 'boolean',
      default: false,
    },
  },
  showBanner: {
    doc: 'Show the banner',
    format: 'boolean',
    default: false,
    env: 'VITE_SHOW_BANNER',
  },
  showSponsorBanner: {
    doc: 'Show the sponsor banner',
    format: 'boolean',
    default: false,
    env: 'VITE_SHOW_SPONSOR_BANNER',
  },
})
  .loadEnv({
    ...import.meta.env,
    // Because the string 'import.meta.env.PACKAGE_VERSION' is statically replaced during build time (see 'define' in vite.config.ts)
    PACKAGE_VERSION: import.meta.env.PACKAGE_VERSION,
  })
  .validate()
  .getConfig();

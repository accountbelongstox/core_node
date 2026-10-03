/** Conventional commit builder: header, body, footers and shell-safe command. */
export const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];

export const SUBJECT_SOFT_LIMIT = 50;
export const SUBJECT_HARD_LIMIT = 72;

export interface CommitDraft {
  type: CommitType;
  scope: string;
  subject: string;
  body: string;
  breaking: boolean;
  breakingNote: string;
  footer: string;
}

export const EMPTY_COMMIT: CommitDraft = { type: 'feat', scope: '', subject: '', body: '', breaking: false, breakingNote: '', footer: '' };

export type CommitWarning = 'emptySubject' | 'subjectLong' | 'subjectTooLong' | 'trailingPeriod' | 'capitalized' | 'scopeSpaces';

export const buildHeader = (draft: CommitDraft): string => {
  const scope = draft.scope.trim();
  return `${draft.type}${scope ? `(${scope})` : ''}${draft.breaking ? '!' : ''}: ${draft.subject.trim()}`;
};

export const buildCommitMessage = (draft: CommitDraft): string => {
  const sections = [buildHeader(draft)];
  if (draft.body.trim()) sections.push(draft.body.trim());
  const footers = [draft.breaking && draft.breakingNote.trim() ? `BREAKING CHANGE: ${draft.breakingNote.trim()}` : '', draft.footer.trim()].filter(Boolean);
  if (footers.length) sections.push(footers.join('\n'));
  return sections.join('\n\n');
};

export const buildGitCommand = (message: string): string => {
  const paragraphs = message.split(/\n\n/);
  return `git commit ${paragraphs.map((paragraph) => `-m '${paragraph.replace(/'/g, `'\\''`)}'`).join(' ')}`;
};

export const lintCommit = (draft: CommitDraft): CommitWarning[] => {
  const warnings: CommitWarning[] = [];
  const subject = draft.subject.trim();
  if (!subject) warnings.push('emptySubject');
  const headerLength = buildHeader(draft).length;
  if (headerLength > SUBJECT_HARD_LIMIT) warnings.push('subjectTooLong');
  else if (headerLength > SUBJECT_SOFT_LIMIT) warnings.push('subjectLong');
  if (subject.endsWith('.')) warnings.push('trailingPeriod');
  if (/^[A-Z][a-z]/.test(subject)) warnings.push('capitalized');
  if (/\s/.test(draft.scope.trim())) warnings.push('scopeSpaces');
  return warnings;
};

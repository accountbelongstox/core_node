import type { OrchComposeConfig } from '../../../../shared/orchestration/orchTypes';

/** Title of what a composition is made from: its book or prompt, else its first short passage (with the number of the others). */
export function orchSourceTitle(config: OrchComposeConfig): string | undefined {
  const main = config.book?.title ?? config.prompt?.title;
  if (main) return main;
  const passages = config.passages ?? [];
  if (passages.length === 0) return undefined;
  return passages.length > 1 ? `${passages[0].title} +${passages.length - 1}` : passages[0].title;
}

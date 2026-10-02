import type { OrchComposeConfig } from '../../../../shared/orchestration/orchTypes';

/** Title of the book or prompt a composition is made from. */
export function orchSourceTitle(config: OrchComposeConfig): string | undefined {
  return config.book?.title ?? config.prompt?.title;
}

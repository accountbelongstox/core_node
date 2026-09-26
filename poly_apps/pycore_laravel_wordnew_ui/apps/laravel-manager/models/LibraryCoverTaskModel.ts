import { api } from '../api';
import type { APIResponse } from '../types';
import { LibraryCoverTaskModel } from '../../../shared/library-cover/LibraryCoverTaskModel';

function payloadOf<T>(response: APIResponse<T>): T {
  if (response.success && response.data) return response.data;
  throw new Error(response.error || response.message || '');
}

/** Library cover tasks for Laravel Manager views (vocabulary cards, db-manager rows). */
export const libraryCoverTaskModel = new LibraryCoverTaskModel({
  enqueue: async (request) => payloadOf(await api.appQyV1.enqueueLibraryCoverTasks(request)),
  status: async (ids) => payloadOf(await api.appQyV1.getLibraryCoverTasks(ids)),
});

export { LibraryCoverTaskModel };
export { libraryCoverView, useLibraryCoverEntry, useLibraryCoverTasks } from '../../../shared/library-cover/LibraryCoverTaskModel';
export type {
  LibraryCoverEntry,
  LibraryCoverPhase,
  LibraryCoverTaskState,
  LibraryCoverView,
} from '../../../shared/library-cover/LibraryCoverTaskModel';

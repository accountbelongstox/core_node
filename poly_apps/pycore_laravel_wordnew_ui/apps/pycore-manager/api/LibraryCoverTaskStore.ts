import { laravelApi } from '../../../core/integrations/laravel';
import { LibraryCoverTaskModel } from '../../../shared/library-cover/LibraryCoverTaskModel';

/** Library cover tasks over the endpoint-following shared Laravel transport. */
export const pcLibraryCoverTaskModel = new LibraryCoverTaskModel({
  enqueue: (request) => laravelApi.enqueueLibraryCoverTasks(request),
  status: (ids) => laravelApi.getLibraryCoverTasks(ids),
});

export { libraryCoverView, useLibraryCoverTasks } from '../../../shared/library-cover/LibraryCoverTaskModel';
export type { LibraryCoverEntry, LibraryCoverPhase, LibraryCoverView } from '../../../shared/library-cover/LibraryCoverTaskModel';

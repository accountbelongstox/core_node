export interface SimilarityConfigChange {
  field: string;
  previousValue: unknown;
  nextValue: unknown;
}

export interface SimilarityReinitializationState {
  required: boolean;
  change?: SimilarityConfigChange;
}

export interface SimilarityModelState {
  status: string;
  downloadProgress: number;
  isDownloading: boolean;
  lastUpdated: number;
  errorMessage: string;
  errorType: string;
}

const SIMILARITY_CONFIG_FIELDS = [
  'modelPreset',
  'modelVersion',
  'modelIdentifier',
  'dimension',
];
const SIMILARITY_VECTOR_DATABASES = [
  'VectorSearchDB',
  'ContentIndexerDB',
  'SemanticSimilarityDB',
];

export function getSimilarityReinitializationState(
  engine: unknown,
  currentConfig: Record<string, any> | null,
  nextConfig: Record<string, any>,
): SimilarityReinitializationState {
  if (!engine || !currentConfig) {
    return { required: true };
  }

  for (const field of SIMILARITY_CONFIG_FIELDS) {
    if (nextConfig[field] !== currentConfig[field]) {
      return {
        required: true,
        change: {
          field,
          previousValue: currentConfig[field],
          nextValue: nextConfig[field],
        },
      };
    }
  }

  return { required: false };
}

export function createSimilarityModelState(
  status: string,
  progress: number,
  errorMessage = '',
  errorType = '',
): SimilarityModelState {
  return {
    status,
    downloadProgress: progress,
    isDownloading: status === 'downloading' || status === 'initializing',
    lastUpdated: Date.now(),
    errorMessage,
    errorType,
  };
}

export async function clearSimilarityVectorDatabases(
  logScope: string,
  logSuccess = false,
): Promise<void> {
  for (const databaseName of SIMILARITY_VECTOR_DATABASES) {
    try {
      const deleteRequest = indexedDB.deleteDatabase(databaseName);
      await new Promise<void>((resolve) => {
        deleteRequest.onsuccess = () => {
          if (logSuccess) {
            console.log(`${logScope}: Successfully deleted database: ${databaseName}`);
          }
          resolve();
        };
        deleteRequest.onerror = () => {
          console.warn(
            `${logScope}: Failed to delete database: ${databaseName}`,
            deleteRequest.error,
          );
          resolve();
        };
        deleteRequest.onblocked = () => {
          console.warn(`${logScope}: Database deletion blocked: ${databaseName}`);
          resolve();
        };
      });
    } catch (error) {
      console.warn(`${logScope}: Error deleting database ${databaseName}:`, error);
    }
  }
}

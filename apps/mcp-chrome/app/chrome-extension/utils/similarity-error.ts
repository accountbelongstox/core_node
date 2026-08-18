export type SimilarityErrorType = 'network' | 'file' | 'unknown';

const NETWORK_ERROR_MARKERS = [
  'network',
  'fetch',
  'timeout',
  'connection',
  'cors',
  'failed to fetch',
];
const FILE_ERROR_MARKERS = ['corrupt', 'invalid', 'format', 'parse', 'decode', 'onnx'];

export function classifySimilarityError(errorMessage: string): SimilarityErrorType {
  const message = errorMessage.toLowerCase();

  if (NETWORK_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return 'network';
  }

  if (FILE_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return 'file';
  }

  return 'unknown';
}

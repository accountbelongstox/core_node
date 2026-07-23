export function bytesToBase64(bytes: number[]): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

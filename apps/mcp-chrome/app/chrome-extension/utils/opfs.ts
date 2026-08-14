export function isOpfsAvailable(): boolean {
  try {
    return (
      typeof navigator !== 'undefined'
      && !!navigator.storage
      && typeof navigator.storage.getDirectory === 'function'
    );
  } catch {
    return false;
  }
}

export async function writeOpfsFile(
  handle: FileSystemFileHandle,
  data: string | Uint8Array,
): Promise<void> {
  const writable = await handle.createWritable();
  let committed = false;

  try {
    await writable.write(data);
    await writable.close();
    committed = true;
  } finally {
    if (!committed) {
      try {
        await writable.abort();
      } catch {
        // Ignore.
      }
    }
  }
}

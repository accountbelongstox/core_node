/**
 * Duoreader .pz decompress (XOR 175 + libbzip2 WASM vendored under /wasm).
 * Replaces antimatter15/bzip2.js — that port fails on ~36% of real article.pz files.
 *
 * WASM glue is statically imported (MV3 service workers forbid dynamic import()).
 */

import initBzip2Wasm from '../public/wasm/bzip2.mjs';
import { InitializationController } from './async';
import { toErrorMessage } from './errors';

const XOR_KEY = 175;
const MIN_DEST_SIZE = 262144;
const MAX_DEST_SIZE = 8 * 1024 * 1024;

const BZ_ERRORS: Record<number, string> = {
  [-2]: 'BZ_PARAM_ERROR',
  [-3]: 'BZ_MEM_ERROR',
  [-4]: 'BZ_DATA_ERROR',
  [-5]: 'BZ_DATA_ERROR_MAGIC',
  [-7]: 'BZ_UNEXPECTED_EOF',
  [-8]: 'BZ_OUTBUFF_FULL',
};

type Bzip2WasmModule = {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  setValue: (ptr: number, value: number, type: string) => void;
  getValue: (ptr: number, type: string) => number;
  HEAPU8: Uint8Array;
  _BZ2_bzBuffToBuffDecompress: (
    dest: number,
    destLen: number,
    src: number,
    srcLen: number,
    small: number,
    verbosity: number,
  ) => number;
};

type Bzip2WasmFactory = (moduleOverrides?: { locateFile?: (path: string) => string }) => Promise<Bzip2WasmModule>;

const wasmInitialization = new InitializationController<Bzip2WasmModule>();

function wasmAssetUrl(file: string): string {
  return chrome.runtime.getURL(`wasm/${file}`);
}

async function getWasmModule(): Promise<Bzip2WasmModule> {
  return wasmInitialization.run(() => {
    const factory = initBzip2Wasm as Bzip2WasmFactory;
    return factory({
      locateFile: (path: string) => wasmAssetUrl(path),
    });
  });
}

function xorBytes(byteList: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(byteList.length);
  for (let i = 0; i < byteList.length; i += 1) {
    out[i] = (byteList[i] ^ XOR_KEY) & 0xff;
  }
  return out;
}

function estimateDestSize(xored: Uint8Array): number {
  let blockDigit = 9;
  if (xored.length >= 4 && xored[0] === 0x42 && xored[1] === 0x5a && xored[2] === 0x68) {
    const digit = xored[3] - 48;
    if (digit >= 1 && digit <= 9) blockDigit = digit;
  }
  const perBlock = blockDigit * 100000;
  const blockGuess = Math.max(1, Math.ceil(xored.length / 40000));
  const estimate = perBlock * blockGuess + 65536;
  return Math.min(MAX_DEST_SIZE, Math.max(MIN_DEST_SIZE, estimate, xored.length * 16));
}

function decompressWithModule(M: Bzip2WasmModule, xored: Uint8Array, destSize: number): Uint8Array {
  const srcPtr = M._malloc(xored.length);
  M.HEAPU8.set(xored, srcPtr);
  const destPtr = M._malloc(destSize);
  const destLenPtr = M._malloc(4);
  M.setValue(destLenPtr, destSize, 'i32');
  const code = M._BZ2_bzBuffToBuffDecompress(
    destPtr,
    destLenPtr,
    srcPtr,
    xored.length,
    0,
    0,
  );
  M._free(srcPtr);
  if (code !== 0) {
    M._free(destPtr);
    M._free(destLenPtr);
    throw new Error(BZ_ERRORS[code] || `BZ2 error ${code}`);
  }
  const actualLen = M.getValue(destLenPtr, 'i32');
  const out = new Uint8Array(actualLen);
  out.set(M.HEAPU8.subarray(destPtr, destPtr + actualLen));
  M._free(destPtr);
  M._free(destLenPtr);
  return out;
}

async function wasmDecompress(xored: Uint8Array): Promise<Uint8Array> {
  const M = await getWasmModule();
  let destSize = estimateDestSize(xored);
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return decompressWithModule(M, xored, destSize);
    } catch (error) {
      lastError = error;
      const msg = toErrorMessage(error);
      if (!msg.includes('OUTBUFF_FULL')) break;
      if (destSize >= MAX_DEST_SIZE) break;
      destSize = Math.min(MAX_DEST_SIZE, destSize * 2);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function unpackDuoreaderPzBytesAsync(byteList: ArrayLike<number>): Promise<Uint8Array> {
  return wasmDecompress(xorBytes(byteList));
}

/** Sync API removed — decode runs in background WASM only. */
export function unpackDuoreaderPzBytes(byteList: ArrayLike<number>): Uint8Array {
  void byteList;
  throw new Error(
    'unpackDuoreaderPzBytes sync is unavailable; use unpackDuoreaderPzBytesAsync via background unpack_pz',
  );
}

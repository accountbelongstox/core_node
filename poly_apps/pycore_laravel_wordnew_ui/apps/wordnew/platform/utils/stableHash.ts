const FNV_64_PRIME = 0x100000001b3n;
const UINT_64_MASK = 0xffffffffffffffffn;
const HASH_OFFSET_A = 0xcbf29ce484222325n;
const HASH_OFFSET_B = 0x84222325cbf29ce4n;

function fnv64(value: string, offset: bigint): bigint {
  let hash = offset;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_64_PRIME) & UINT_64_MASK;
  }
  return hash;
}

/** Stable 128-bit non-cryptographic identifier for persisted keys and scopes. */
export function stableHash(value: string): string {
  const left = fnv64(value, HASH_OFFSET_A).toString(16).padStart(16, '0');
  const right = fnv64(value, HASH_OFFSET_B).toString(16).padStart(16, '0');
  return `${left}${right}`;
}

/** Collision-resistant SQL identifier that preserves already-safe names. */
export function stableIdentifier(value: string, fallback = 'value'): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return value;
  const readable = value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&').slice(0, 48);
  return `${readable || fallback}_${stableHash(value).slice(0, 16)}`;
}

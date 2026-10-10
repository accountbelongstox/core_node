export type LocalDataSource =
  | { kind: 'localStorage'; keys?: readonly string[]; prefixes?: readonly string[] }
  | { kind: 'deviceKv'; keys?: readonly string[]; prefixes?: readonly string[] }
  | { kind: 'collections'; names?: readonly string[]; resolve?: () => Promise<readonly string[]> }
  | { kind: 'cacheStorage'; prefixes?: readonly string[] };

export type LocalDataSourceKind = LocalDataSource['kind'];

export interface LocalDataGroup {
  /** Unique, `<app>.<name>`. Registering the same id again replaces the group. */
  id: string;
  appId: string;
  /** Fully qualified i18n key of the group label (default translation namespace). */
  labelKey: string;
  descriptionKey?: string;
  /** False for auth, session, endpoint selection and unsynced data: reported, never wiped. */
  clearable: boolean;
  sources: readonly LocalDataSource[];
  /** Replaces the default source wipe when the owner must clear through its own write queue. */
  clear?: () => Promise<void>;
}

const groups = new Map<string, LocalDataGroup>();

export function registerLocalDataGroup(group: LocalDataGroup): void {
  groups.set(group.id, group);
}

export function registerLocalDataGroups(list: readonly LocalDataGroup[]): void {
  list.forEach(registerLocalDataGroup);
}

export function getLocalDataGroups(): LocalDataGroup[] {
  return [...groups.values()];
}

export function getLocalDataGroup(id: string): LocalDataGroup | undefined {
  return groups.get(id);
}

/** Exact keys beat prefixes; among prefixes the longest wins; ties go to the earlier registration. */
export function ownerOfKey(kind: 'localStorage' | 'deviceKv' | 'cacheStorage', key: string): LocalDataGroup | null {
  let prefixOwner: LocalDataGroup | null = null;
  let prefixLength = -1;
  for (const group of groups.values()) {
    for (const source of group.sources) {
      if (source.kind !== kind) continue;
      if (source.kind !== 'cacheStorage' && source.keys?.includes(key)) return group;
      for (const prefix of source.prefixes ?? []) {
        if (key.startsWith(prefix) && prefix.length > prefixLength) {
          prefixOwner = group;
          prefixLength = prefix.length;
        }
      }
    }
  }
  return prefixOwner;
}

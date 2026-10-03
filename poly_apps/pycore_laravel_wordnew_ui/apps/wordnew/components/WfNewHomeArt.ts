/** 3D illustrations (`assets/home/<art>.webp`); a missing one falls back to the caller's icon. */
const HOME_ART = import.meta.glob('../assets/home/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const homeArt = (name: string): string | undefined => HOME_ART[`../assets/home/${name}.webp`];

import type { ComputedRef, MaybeRef } from 'vue'
export type LayoutKey = "admin" | "auth-layout" | "base" | "codemart-layout" | "dashboard" | "default-with-nav" | "pymatrix"
declare module 'nuxt/app' {
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}
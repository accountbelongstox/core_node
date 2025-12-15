
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T extends DefineComponent> = T & DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>>
type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = (T & DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }>)
interface _GlobalComponents {
      'ThemeCustomizer': typeof import("../components/ThemeCustomizer.vue")['default']
    'CodemartSidebar': typeof import("../components/codemart/CodemartSidebar.vue")['default']
    'CodemartHomeCodemartFooter': typeof import("../components/codemart/home/CodemartFooter.vue")['default']
    'CodemartHomeCodemartHeader': typeof import("../components/codemart/home/CodemartHeader.vue")['default']
    'CodemartHomeCustomerServiceButton': typeof import("../components/codemart/home/CustomerServiceButton.vue")['default']
    'CodemartHomeHeroCarousel': typeof import("../components/codemart/home/HeroCarousel.vue")['default']
    'CodemartHomeServiceFlowSection': typeof import("../components/codemart/home/ServiceFlowSection.vue")['default']
    'CodemartHomeStatisticsSection': typeof import("../components/codemart/home/StatisticsSection.vue")['default']
    'CodemartHomeTestimonialsCarousel': typeof import("../components/codemart/home/TestimonialsCarousel.vue")['default']
    'LayoutFooter': typeof import("../components/layout/Footer.vue")['default']
    'LayoutHeader': typeof import("../components/layout/Header.vue")['default']
    'LayoutSidebar': typeof import("../components/layout/Sidebar.vue")['default']
    'PluginsQuillEditor': typeof import("../components/plugins/QuillEditor.vue")['default']
    'PluginsHighlight': typeof import("../components/plugins/highlight.vue")['default']
    'SharedDashboardProgressChart': typeof import("../components/shared/dashboard/ProgressChart.vue")['default']
    'SharedDashboardStatCard': typeof import("../components/shared/dashboard/StatCard.vue")['default']
    'SharedDashboardWelcomeCard': typeof import("../components/shared/dashboard/WelcomeCard.vue")['default']
    'SharedLayoutMainHeader': typeof import("../components/shared/layout/MainHeader.vue")['default']
    'SharedUiDataTable': typeof import("../components/shared/ui/DataTable.vue")['default']
    'SubsiteAdminSidebar': typeof import("../components/subsite-admin/AdminSidebar.vue")['default']
    'NuxtWelcome': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/welcome.vue")['default']
    'NuxtLayout': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
    'NuxtErrorBoundary': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
    'ClientOnly': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/client-only")['default']
    'DevOnly': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/dev-only")['default']
    'ServerPlaceholder': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
    'NuxtLink': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-link")['default']
    'NuxtLoadingIndicator': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
    'NuxtTime': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
    'NuxtRouteAnnouncer': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
    'NuxtImg': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
    'NuxtPicture': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
    'NuxtLinkLocale': typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/NuxtLinkLocale")['default']
    'SwitchLocalePathLink': typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/SwitchLocalePathLink")['default']
    'NuxtPage': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/pages/runtime/page")['default']
    'NoScript': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['NoScript']
    'Link': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Link']
    'Base': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Base']
    'Title': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Title']
    'Meta': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Meta']
    'Style': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Style']
    'Head': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Head']
    'Html': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Html']
    'Body': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Body']
    'NuxtIsland': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-island")['default']
    'NuxtRouteAnnouncer': typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
      'LazyThemeCustomizer': LazyComponent<typeof import("../components/ThemeCustomizer.vue")['default']>
    'LazyCodemartSidebar': LazyComponent<typeof import("../components/codemart/CodemartSidebar.vue")['default']>
    'LazyCodemartHomeCodemartFooter': LazyComponent<typeof import("../components/codemart/home/CodemartFooter.vue")['default']>
    'LazyCodemartHomeCodemartHeader': LazyComponent<typeof import("../components/codemart/home/CodemartHeader.vue")['default']>
    'LazyCodemartHomeCustomerServiceButton': LazyComponent<typeof import("../components/codemart/home/CustomerServiceButton.vue")['default']>
    'LazyCodemartHomeHeroCarousel': LazyComponent<typeof import("../components/codemart/home/HeroCarousel.vue")['default']>
    'LazyCodemartHomeServiceFlowSection': LazyComponent<typeof import("../components/codemart/home/ServiceFlowSection.vue")['default']>
    'LazyCodemartHomeStatisticsSection': LazyComponent<typeof import("../components/codemart/home/StatisticsSection.vue")['default']>
    'LazyCodemartHomeTestimonialsCarousel': LazyComponent<typeof import("../components/codemart/home/TestimonialsCarousel.vue")['default']>
    'LazyLayoutFooter': LazyComponent<typeof import("../components/layout/Footer.vue")['default']>
    'LazyLayoutHeader': LazyComponent<typeof import("../components/layout/Header.vue")['default']>
    'LazyLayoutSidebar': LazyComponent<typeof import("../components/layout/Sidebar.vue")['default']>
    'LazyPluginsQuillEditor': LazyComponent<typeof import("../components/plugins/QuillEditor.vue")['default']>
    'LazyPluginsHighlight': LazyComponent<typeof import("../components/plugins/highlight.vue")['default']>
    'LazySharedDashboardProgressChart': LazyComponent<typeof import("../components/shared/dashboard/ProgressChart.vue")['default']>
    'LazySharedDashboardStatCard': LazyComponent<typeof import("../components/shared/dashboard/StatCard.vue")['default']>
    'LazySharedDashboardWelcomeCard': LazyComponent<typeof import("../components/shared/dashboard/WelcomeCard.vue")['default']>
    'LazySharedLayoutMainHeader': LazyComponent<typeof import("../components/shared/layout/MainHeader.vue")['default']>
    'LazySharedUiDataTable': LazyComponent<typeof import("../components/shared/ui/DataTable.vue")['default']>
    'LazySubsiteAdminSidebar': LazyComponent<typeof import("../components/subsite-admin/AdminSidebar.vue")['default']>
    'LazyNuxtWelcome': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
    'LazyNuxtLayout': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
    'LazyNuxtErrorBoundary': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
    'LazyClientOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/client-only")['default']>
    'LazyDevOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/dev-only")['default']>
    'LazyServerPlaceholder': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
    'LazyNuxtLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
    'LazyNuxtLoadingIndicator': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
    'LazyNuxtTime': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
    'LazyNuxtImg': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
    'LazyNuxtPicture': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
    'LazyNuxtLinkLocale': LazyComponent<typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/NuxtLinkLocale")['default']>
    'LazySwitchLocalePathLink': LazyComponent<typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/SwitchLocalePathLink")['default']>
    'LazyNuxtPage': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/pages/runtime/page")['default']>
    'LazyNoScript': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
    'LazyLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Link']>
    'LazyBase': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Base']>
    'LazyTitle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Title']>
    'LazyMeta': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Meta']>
    'LazyStyle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Style']>
    'LazyHead': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Head']>
    'LazyHtml': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Html']>
    'LazyBody': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Body']>
    'LazyNuxtIsland': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export const ThemeCustomizer: typeof import("../components/ThemeCustomizer.vue")['default']
export const CodemartSidebar: typeof import("../components/codemart/CodemartSidebar.vue")['default']
export const CodemartHomeCodemartFooter: typeof import("../components/codemart/home/CodemartFooter.vue")['default']
export const CodemartHomeCodemartHeader: typeof import("../components/codemart/home/CodemartHeader.vue")['default']
export const CodemartHomeCustomerServiceButton: typeof import("../components/codemart/home/CustomerServiceButton.vue")['default']
export const CodemartHomeHeroCarousel: typeof import("../components/codemart/home/HeroCarousel.vue")['default']
export const CodemartHomeServiceFlowSection: typeof import("../components/codemart/home/ServiceFlowSection.vue")['default']
export const CodemartHomeStatisticsSection: typeof import("../components/codemart/home/StatisticsSection.vue")['default']
export const CodemartHomeTestimonialsCarousel: typeof import("../components/codemart/home/TestimonialsCarousel.vue")['default']
export const LayoutFooter: typeof import("../components/layout/Footer.vue")['default']
export const LayoutHeader: typeof import("../components/layout/Header.vue")['default']
export const LayoutSidebar: typeof import("../components/layout/Sidebar.vue")['default']
export const PluginsQuillEditor: typeof import("../components/plugins/QuillEditor.vue")['default']
export const PluginsHighlight: typeof import("../components/plugins/highlight.vue")['default']
export const SharedDashboardProgressChart: typeof import("../components/shared/dashboard/ProgressChart.vue")['default']
export const SharedDashboardStatCard: typeof import("../components/shared/dashboard/StatCard.vue")['default']
export const SharedDashboardWelcomeCard: typeof import("../components/shared/dashboard/WelcomeCard.vue")['default']
export const SharedLayoutMainHeader: typeof import("../components/shared/layout/MainHeader.vue")['default']
export const SharedUiDataTable: typeof import("../components/shared/ui/DataTable.vue")['default']
export const SubsiteAdminSidebar: typeof import("../components/subsite-admin/AdminSidebar.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtLinkLocale: typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/NuxtLinkLocale")['default']
export const SwitchLocalePathLink: typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/SwitchLocalePathLink")['default']
export const NuxtPage: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const LazyThemeCustomizer: LazyComponent<typeof import("../components/ThemeCustomizer.vue")['default']>
export const LazyCodemartSidebar: LazyComponent<typeof import("../components/codemart/CodemartSidebar.vue")['default']>
export const LazyCodemartHomeCodemartFooter: LazyComponent<typeof import("../components/codemart/home/CodemartFooter.vue")['default']>
export const LazyCodemartHomeCodemartHeader: LazyComponent<typeof import("../components/codemart/home/CodemartHeader.vue")['default']>
export const LazyCodemartHomeCustomerServiceButton: LazyComponent<typeof import("../components/codemart/home/CustomerServiceButton.vue")['default']>
export const LazyCodemartHomeHeroCarousel: LazyComponent<typeof import("../components/codemart/home/HeroCarousel.vue")['default']>
export const LazyCodemartHomeServiceFlowSection: LazyComponent<typeof import("../components/codemart/home/ServiceFlowSection.vue")['default']>
export const LazyCodemartHomeStatisticsSection: LazyComponent<typeof import("../components/codemart/home/StatisticsSection.vue")['default']>
export const LazyCodemartHomeTestimonialsCarousel: LazyComponent<typeof import("../components/codemart/home/TestimonialsCarousel.vue")['default']>
export const LazyLayoutFooter: LazyComponent<typeof import("../components/layout/Footer.vue")['default']>
export const LazyLayoutHeader: LazyComponent<typeof import("../components/layout/Header.vue")['default']>
export const LazyLayoutSidebar: LazyComponent<typeof import("../components/layout/Sidebar.vue")['default']>
export const LazyPluginsQuillEditor: LazyComponent<typeof import("../components/plugins/QuillEditor.vue")['default']>
export const LazyPluginsHighlight: LazyComponent<typeof import("../components/plugins/highlight.vue")['default']>
export const LazySharedDashboardProgressChart: LazyComponent<typeof import("../components/shared/dashboard/ProgressChart.vue")['default']>
export const LazySharedDashboardStatCard: LazyComponent<typeof import("../components/shared/dashboard/StatCard.vue")['default']>
export const LazySharedDashboardWelcomeCard: LazyComponent<typeof import("../components/shared/dashboard/WelcomeCard.vue")['default']>
export const LazySharedLayoutMainHeader: LazyComponent<typeof import("../components/shared/layout/MainHeader.vue")['default']>
export const LazySharedUiDataTable: LazyComponent<typeof import("../components/shared/ui/DataTable.vue")['default']>
export const LazySubsiteAdminSidebar: LazyComponent<typeof import("../components/subsite-admin/AdminSidebar.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtLinkLocale: LazyComponent<typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/NuxtLinkLocale")['default']>
export const LazySwitchLocalePathLink: LazyComponent<typeof import("../node_modules/.pnpm/@nuxtjs+i18n@10.2.1_@netlif_836efeb45fd2f03c74eb3b2b8c2d0257/node_modules/@nuxtjs/i18n/dist/runtime/components/SwitchLocalePathLink")['default']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@4.0.0_@netlify+blobs@9_cdf6588a58167788c4348fbfbdccfc8c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>

export const componentNames: string[]

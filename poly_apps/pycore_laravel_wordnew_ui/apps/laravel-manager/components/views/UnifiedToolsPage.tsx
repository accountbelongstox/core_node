import React, { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Star, Clock, X, ChevronLeft, Sparkles, Wrench, Layers, Boxes, StarOff, Menu, ArrowLeft, Loader,
} from 'lucide-react';
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import MCPManager from './MCPManager';
import AITools from './AITools';
import {
  AI_TOOLS_CATEGORY,
  MCP_TOOLS_CATEGORY,
  getUnifiedToolAccent as getAccent,
  getUnifiedToolCategoryMeta as getCategoryMeta,
  unifiedToolsInputClass as inputCls,
  type ToolsViewTab as ViewTab,
} from './unifiedToolsTheme';
import {
  CANONICAL_TOOLS, categoryLabel, getCanonicalTool, listToolCategories, toolLabel, toolSummary,
} from './tools/toolCatalog';
import { toolUsageStore, useToolUsage } from './tools/toolUsageStore';
import { getToolWorkbench } from './tools/toolWorkbenches';
import GenericToolForm from './tools/GenericToolForm';
import ToolErrorBoundary from './tools/ToolErrorBoundary';

const RECENT_LIMIT = 10;

interface OpenTool {
  tool: ToolDefinition;
  variant: string;
}

/**
 * Tools page shell: tabs, category nav, card grid and the selected tool's own workbench.
 * Each tool renders its dedicated workbench from `tools/<group>`; GenericToolForm covers the rest.
 */
export function UnifiedToolsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openTool, setOpenTool] = useState<OpenTool | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { favorites, history } = useToolUsage();
  const categories = useMemo(() => listToolCategories(), []);

  const recentTools = useMemo(
    () => history.slice(0, RECENT_LIMIT).map((h) => getCanonicalTool(h.toolId)).filter((x): x is ToolDefinition => Boolean(x)),
    [history],
  );

  const tabScopedTools = useMemo<ToolDefinition[]>(() => {
    if (activeTab === 'favorites') return CANONICAL_TOOLS.filter((tool) => favorites.includes(tool.id));
    if (activeTab === 'recent') return recentTools;
    return CANONICAL_TOOLS;
  }, [activeTab, favorites, recentTools]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tabScopedTools.forEach((tool) => { counts[tool.category] = (counts[tool.category] || 0) + 1; });
    return counts;
  }, [tabScopedTools]);

  const gridTools = useMemo<ToolDefinition[]>(() => {
    let tools = tabScopedTools;
    if (selectedCategory !== 'all') tools = tools.filter((tool) => tool.category === selectedCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      tools = tools.filter((tool) =>
        [tool.name, tool.description, tool.category, toolLabel(t, tool), toolSummary(t, tool), categoryLabel(t, tool.category)]
          .some((text) => text.toLowerCase().includes(q)));
    }
    return tools;
  }, [tabScopedTools, selectedCategory, searchQuery, t]);

  const selectTool = (tool: ToolDefinition) => {
    const canonical = getCanonicalTool(tool.id) ?? tool;
    const variant = history.find((h) => h.toolId === canonical.id)?.variant ?? canonical.id;
    setOpenTool({ tool: canonical, variant });
    setMobileNavOpen(false);
  };

  const pickCategory = (category: string) => {
    setSelectedCategory(category);
    setOpenTool(null);
    setMobileNavOpen(false);
  };

  const navButtonCls = (active: boolean, activeCls: string) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
      active ? activeCls : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
    }`;

  const countBadge = (count: number) => (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{count}</span>
  );

  const renderCategoryNav = () => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
      <button onClick={() => pickCategory(AI_TOOLS_CATEGORY)}
        className={navButtonCls(selectedCategory === AI_TOOLS_CATEGORY, 'bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30')}>
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{t('uiTools.page.nav_ai_tools')}</span>
      </button>
      <button onClick={() => pickCategory('all')}
        className={navButtonCls(selectedCategory === 'all', 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30')}>
        <Layers className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{t('uiTools.page.nav_all_tools')}</span>
        {countBadge(tabScopedTools.length)}
      </button>
      {categories
        .filter((cat) => (categoryCounts[cat] || 0) > 0)
        .sort((a, b) => categoryLabel(t, a).localeCompare(categoryLabel(t, b)))
        .map((category) => {
          const meta = getCategoryMeta(category);
          const accent = getAccent(meta.accent);
          const Icon = meta.icon;
          return (
            <button key={category} onClick={() => pickCategory(category)}
              className={navButtonCls(selectedCategory === category, `${accent.chip} ring-1 ${accent.ring}`)}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{categoryLabel(t, category)}</span>
              {countBadge(categoryCounts[category])}
            </button>
          );
        })}
      <button onClick={() => pickCategory(MCP_TOOLS_CATEGORY)}
        className={navButtonCls(selectedCategory === MCP_TOOLS_CATEGORY, 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30')}>
        <Boxes className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{t('uiTools.page.nav_mcp_server')}</span>
      </button>
    </nav>
  );

  const renderToolCard = (tool: ToolDefinition) => {
    const meta = getCategoryMeta(tool.category);
    const accent = getAccent(meta.accent);
    const Icon = meta.icon;
    const isFav = favorites.includes(tool.id);
    return (
      <div key={tool.id} role="button" tabIndex={0} onClick={() => selectTool(tool)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTool(tool); } }}
        className={`group relative cursor-pointer text-left flex flex-col gap-3 p-4 rounded-xl border transition-all
          bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60
          hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/50
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${tool.unavailable ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${accent.iconBg}`}><Icon className="w-5 h-5" /></div>
          <button type="button" onClick={(e) => { e.stopPropagation(); toolUsageStore.toggleFavorite(tool.id); }}
            className="p-1.5 -m-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
            title={isFav ? t('uiTools.page.favorite_remove') : t('uiTools.page.favorite_add')}>
            <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`} />
          </button>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{toolLabel(t, tool)}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{toolSummary(t, tool)}</p>
        </div>
        <span className={`mt-auto inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${accent.chip}`}>
          {categoryLabel(t, tool.category)}
        </span>
      </div>
    );
  };

  const renderWorkbench = ({ tool, variant }: OpenTool) => {
    const meta = getCategoryMeta(tool.category);
    const accent = getAccent(meta.accent);
    const Icon = meta.icon;
    const Workbench = getToolWorkbench(tool.id);
    const lastRun = toolUsageStore.lastRun(tool.id);
    const isFav = favorites.includes(tool.id);
    return (
      <section className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/30">
          <button onClick={() => setOpenTool(null)} title={t('uiTools.page.back_to_tools')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${accent.iconBg}`}><Icon className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{toolLabel(t, tool)}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{toolSummary(t, tool)}</p>
          </div>
          <button onClick={() => toolUsageStore.toggleFavorite(tool.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isFav ? t('uiTools.page.favorite_remove') : t('uiTools.page.favorite_add')}>
            <Star className={`w-5 h-5 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
          </button>
        </div>
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [&_.grid>*]:min-w-0">
          <ToolErrorBoundary key={`${tool.id}:${variant}`}>
          <Suspense fallback={(
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader className="w-4 h-4 animate-spin" />{t('uiTools.workbench.loading')}
            </div>
          )}>
            {Workbench
              ? <Workbench key={`${tool.id}:${variant}`} tool={tool} variant={variant} lastRun={lastRun} />
              : <GenericToolForm key={`${tool.id}:${variant}`} tool={tool} variant={variant} lastRun={lastRun} />}
          </Suspense>
          </ToolErrorBoundary>
        </div>
      </section>
    );
  };

  const tabBtn = (tab: ViewTab, label: string, Icon: typeof Layers, count: number, activeCls: string) => (
    <button onClick={() => { setActiveTab(tab); setOpenTool(null); }}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === tab ? activeCls : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
      }`}>
      <Icon className={`w-4 h-4 ${tab === 'favorites' && activeTab === tab ? 'fill-current' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
      <span className="px-1.5 py-0.5 bg-black/10 dark:bg-white/15 rounded-full text-xs">{count}</span>
    </button>
  );

  const emptyTitle = activeTab === 'favorites' ? 'empty_favorites_title' : activeTab === 'recent' ? 'empty_recent_title' : 'empty_search_title';
  const emptyHint = activeTab === 'favorites' ? 'empty_favorites_hint'
    : activeTab === 'recent' ? 'empty_recent_hint' : searchQuery ? 'empty_search_hint' : 'empty_category_hint';
  const EmptyIcon = activeTab === 'favorites' ? StarOff : activeTab === 'recent' ? Clock : Search;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
          <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title={t('uiTools.page.categories')}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="relative">
              <Wrench className="w-7 h-7 text-indigo-500" />
              <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">{t('uiTools.page.title')}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('uiTools.page.tools_count', { count: CANONICAL_TOOLS.length })}</p>
            </div>
          </div>
          <div className="relative flex-1 sm:flex-none order-2 sm:order-none min-w-[160px] sm:min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setOpenTool(null); }}
              placeholder={t('uiTools.page.search_placeholder')} className={inputCls + ' pl-9 sm:w-60'} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>
        <nav className="flex justify-center border-t border-slate-200/80 dark:border-slate-800/80 px-4 py-2">
          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1">
            {tabBtn('all', t('uiTools.page.tab_tools'), Layers, CANONICAL_TOOLS.length, 'bg-indigo-600 text-white shadow-sm')}
            {tabBtn('favorites', t('uiTools.page.tab_favorites'), Star, favorites.length, 'bg-amber-500 text-white shadow-sm')}
            {tabBtn('recent', t('uiTools.page.tab_recent'), Clock, history.length, 'bg-purple-600 text-white shadow-sm')}
          </div>
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-sm">{t('uiTools.page.categories')}</h2>
          </div>
          {renderCategoryNav()}
        </aside>

        {mobileNavOpen && (
          <Portal>
            <div className={`lg:hidden fixed inset-0 ${OVERLAY_Z.modal} flex`}>
              <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
              <aside className="shell-safe-area relative w-72 max-w-[85%] h-full flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 shadow-xl animate-in slide-in-from-left duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <h2 className="font-semibold text-sm">{t('uiTools.page.categories')}</h2>
                  </div>
                  <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderCategoryNav()}
              </aside>
            </div>
          </Portal>
        )}

        <main className="flex-1 flex overflow-hidden">
          {selectedCategory === AI_TOOLS_CATEGORY ? (
            <section className="flex-1 overflow-hidden"><AITools /></section>
          ) : selectedCategory === MCP_TOOLS_CATEGORY ? (
            <section className="flex-1 overflow-auto p-4 sm:p-6"><MCPManager allowedTabs={['screenshots', 'placeholder']} /></section>
          ) : openTool ? (
            renderWorkbench(openTool)
          ) : (
            <section className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedCategory === 'all' ? t('uiTools.page.nav_all_tools') : categoryLabel(t, selectedCategory)}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('uiTools.page.tools_count', { count: gridTools.length })}
                  {searchQuery && <> {t('uiTools.page.matching_query', { query: searchQuery })}</>}
                </p>
              </div>
              {gridTools.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {gridTools.map(renderToolCard)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto">
                  <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800/60 mb-4"><EmptyIcon className="w-12 h-12 text-slate-400" /></div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{t(`uiTools.page.${emptyTitle}`)}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t(`uiTools.page.${emptyHint}`)}</p>
                  {(searchQuery || selectedCategory !== 'all') && (
                    <button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all">
                      <ChevronLeft className="w-4 h-4" /> {t('uiTools.page.clear_filters')}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

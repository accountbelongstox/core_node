import React, { useState, useEffect } from 'react';
import { ALL_TOOLS, getToolsByCategory, getAllCategories } from '../../config/tools.config';
import { ToolConfig } from '../../core/types';
import { api } from '../../core/api';
import { useToast } from '../admin';
import {
  Search, Star, Clock, Play, Loader, Copy, Check, X, ChevronRight, ChevronDown,
  Sparkles, Wrench, Hash, Code, Calculator, Globe, Image, FileCode, Lock,
  Database, Network, Type, Zap, TrendingUp, Layers, Info, BookOpen,
  Lightbulb, History, StarOff, Menu, FileText, FileJson
} from 'lucide-react';
import { downloadAsFile, toJsonString, copyToClipboard, buildExportFilename } from '../../utils/exportResult';

/**
 * IT Tools Dashboard - Premium Edition
 *
 * Layout:
 * - Top: Tab navigation (Tools/Favorites/Recent)
 * - Left: Collapsible category sidebar
 * - Center: Tool workspace
 * - Right: Info panel (optional)
 */

interface ToolHistory {
  toolId: string;
  toolName: string;
  timestamp: number;
  input: any;
  output: any;
}

type ViewTab = 'all' | 'favorites' | 'recent';

export function UnifiedToolsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Tool execution state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Favorites and history
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('unified_tool_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<ToolHistory[]>(() => {
    const saved = localStorage.getItem('unified_tool_history');
    return saved ? JSON.parse(saved) : [];
  });

  const toast = useToast();
  const categories = getAllCategories();

  // Category configuration with icons and colors
  const categoryConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
    'Crypto & Security': { icon: Lock, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    'Converters': { icon: Code, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'Web Development': { icon: Globe, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    'Text Processing': { icon: Type, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    'Math & Calculation': { icon: Calculator, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    'Network Tools': { icon: Network, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    'Image Tools': { icon: Image, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    'Calculators': { icon: Calculator, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    'PDF Tools': { icon: FileCode, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    'AI Tools': { icon: Sparkles, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/10' },
    'Server Manager': { icon: Wrench, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
    'Media Tools': { icon: Database, color: 'text-lime-400', bgColor: 'bg-lime-500/10' }
  };

  // Get recent tools (last 10)
  const recentTools = history.slice(0, 10).map(h => ALL_TOOLS[h.toolId]).filter(Boolean);

  // Filter tools based on active tab and search
  const getFilteredTools = () => {
    let tools = Object.values(ALL_TOOLS);

    // Apply tab filter
    if (activeTab === 'favorites') {
      tools = tools.filter(tool => favorites.includes(tool.id));
    } else if (activeTab === 'recent') {
      tools = recentTools;
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      tools = tools.filter(tool => tool.category === selectedCategory);
    }

    // Apply search filter
    if (searchQuery) {
      tools = tools.filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return tools;
  };

  const filteredTools = getFilteredTools();

  // Group tools by category
  const toolsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = filteredTools.filter(tool => tool.category === cat);
    return acc;
  }, {} as Record<string, ToolConfig[]>);

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Toggle favorite
  const toggleFavorite = (toolId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const newFavorites = prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId];
      localStorage.setItem('unified_tool_favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Add to history
  const addToHistory = (tool: ToolConfig, input: any, output: any) => {
    setHistory(prev => {
      const newHistory = [
        { toolId: tool.id, toolName: tool.name, timestamp: Date.now(), input, output },
        ...prev.filter(h => h.toolId !== tool.id)
      ].slice(0, 50);
      localStorage.setItem('unified_tool_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Handle tool selection
  const handleToolSelect = (tool: ToolConfig) => {
    setSelectedTool(tool);
    setFormData({});
    setResult(null);
    setError(null);
  };

  // Handle input change
  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Execute tool
  const executeTool = async () => {
    if (!selectedTool) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const [moduleName, methodName] = selectedTool.apiMethod.split('.');
      const apiModule = (api as any)[moduleName];

      if (!apiModule || typeof apiModule[methodName] !== 'function') {
        throw new Error(`API method ${selectedTool.apiMethod} not found`);
      }

      const response = await apiModule[methodName](formData);

      if (response.success) {
        setResult(response.data);
        addToHistory(selectedTool, formData, response.data);
        toast.success(`${selectedTool.name} executed successfully`);
      } else {
        setError(response.message || 'Operation failed');
        toast.error(response.message || 'Operation failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Build the raw string representation of the current result
  const getResultAsText = (): string =>
    typeof result === 'string' ? result : toJsonString(result);

  // Copy result
  const copyResult = async () => {
    if (!result) return;
    const ok = await copyToClipboard(getResultAsText());
    if (ok) {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Export result as a pretty-printed JSON file
  const exportResultAsJson = () => {
    if (!result) return;
    const toolId = selectedTool?.id || 'result';
    downloadAsFile(
      toJsonString(result),
      buildExportFilename(toolId, 'json'),
      'application/json',
    );
    toast.success('Exported as JSON');
  };

  // Export result as a plain text file
  const exportResultAsTxt = () => {
    if (!result) return;
    const toolId = selectedTool?.id || 'result';
    downloadAsFile(
      getResultAsText(),
      buildExportFilename(toolId, 'txt'),
      'text/plain',
    );
    toast.success('Exported as TXT');
  };

  // Render form field
  const renderFormField = (fieldName: string, fieldSchema: any) => {
    const value = formData[fieldName] || '';
    const isRequired = selectedTool?.inputSchema.required?.includes(fieldName);

    return (
      <div key={fieldName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">
          {fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          {isRequired && <span className="text-rose-400 ml-1">*</span>}
        </label>

        {fieldSchema.enum ? (
          <select
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm transition-all"
          >
            <option value="">Select...</option>
            {fieldSchema.enum.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : fieldSchema.type === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(fieldName, parseFloat(e.target.value))}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm transition-all"
            placeholder={`Enter ${fieldName}`}
          />
        ) : fieldSchema.type === 'boolean' ? (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(fieldName, e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm text-gray-300">Enable</span>
          </label>
        ) : fieldSchema.type === 'file' ? (
          <input
            type="file"
            onChange={(e) => handleInputChange(fieldName, e.target.files?.[0])}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm resize-none transition-all"
            placeholder={`Enter ${fieldName}...`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="relative z-10 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Wrench className="w-8 h-8 text-blue-500" />
              <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                IT Tools Dashboard
              </h1>
              <p className="text-xs text-gray-500">{Object.keys(ALL_TOOLS).length} powerful tools</p>
            </div>
          </div>

          {/* Center: Tabs */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              Tools
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{Object.keys(ALL_TOOLS).length}</span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'favorites'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Star className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
              Favorites
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{favorites.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'recent'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Clock className="w-4 h-4" />
              Recent
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{history.length}</span>
            </button>
          </div>

          {/* Right: Search & Info Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-64 pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => setShowInfoPanel(!showInfoPanel)}
              className={`p-2.5 rounded-lg transition-all ${
                showInfoPanel
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-gray-400 hover:text-white'
              }`}
              title="Toggle info panel"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left Sidebar - Categories */}
        <div className={`${sidebarCollapsed ? 'w-14' : 'w-72'} flex flex-col bg-slate-900/50 backdrop-blur-sm border-r border-slate-800/50 transition-all duration-300`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h2 className="font-bold">Categories</h2>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-all"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {/* All Tools */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all ${
                selectedCategory === 'all'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:bg-slate-800/50 hover:text-white'
              }`}
              title="All Tools"
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">All Tools</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-800/50 rounded-full">
                    {filteredTools.length}
                  </span>
                </>
              )}
            </button>

            {/* Category Groups */}
            {categories.map(category => {
              const config = categoryConfig[category] || { icon: Hash, color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
              const Icon = config.icon;
              const toolsInCategory = toolsByCategory[category] || [];
              const isCollapsed = collapsedCategories.has(category);
              const isSelected = selectedCategory === category;

              if (toolsInCategory.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    onClick={() => {
                      if (sidebarCollapsed) {
                        setSidebarCollapsed(false);
                      }
                      toggleCategory(category);
                      setSelectedCategory(category);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all ${
                      isSelected
                        ? `${config.bgColor} ${config.color} border border-current`
                        : 'text-gray-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                    title={category}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium truncate">{category}</span>
                        <span className="text-xs px-2 py-0.5 bg-slate-800/50 rounded-full">
                          {toolsInCategory.length}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      </>
                    )}
                  </button>

                  {/* Category Tools */}
                  {!sidebarCollapsed && !isCollapsed && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {toolsInCategory.slice(0, 5).map(tool => (
                        <button
                          key={tool.id}
                          onClick={() => handleToolSelect(tool)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                            selectedTool?.id === tool.id
                              ? 'bg-slate-800 text-white'
                              : 'text-gray-500 hover:bg-slate-800/50 hover:text-gray-300'
                          }`}
                        >
                          <span className="truncate">{tool.name}</span>
                          {favorites.includes(tool.id) && (
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0 ml-1" />
                          )}
                        </button>
                      ))}
                      {toolsInCategory.length > 5 && (
                        <div className="px-3 py-1 text-xs text-gray-600">
                          +{toolsInCategory.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center - Tool Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTool ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tool Header */}
              <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-900/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-white">{selectedTool.name}</h2>
                      <button
                        onClick={(e) => toggleFavorite(selectedTool.id, e)}
                        className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-all"
                      >
                        <Star className={`w-5 h-5 ${favorites.includes(selectedTool.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}`} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{selectedTool.description}</p>
                    {(() => {
                      const config = categoryConfig[selectedTool.category] || categoryConfig['Converters'];
                      const Icon = config.icon;
                      return (
                        <div className={`inline-flex items-center gap-2 px-3 py-1 ${config.bgColor} ${config.color} rounded-lg text-xs font-medium`}>
                          <Icon className="w-3.5 h-3.5" />
                          {selectedTool.category}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="p-2 hover:bg-slate-800/50 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Tool Form */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Input Section */}
                  <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Code className="w-5 h-5 text-blue-400" />
                      Input
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(selectedTool.inputSchema.properties || {}).map(([fieldName, fieldSchema]) =>
                        renderFormField(fieldName, fieldSchema)
                      )}
                    </div>
                  </div>

                  {/* Execute Button */}
                  <button
                    onClick={executeTool}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-bold text-white transition-all shadow-xl hover:shadow-blue-500/50 disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Execute Tool
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-rose-500/20 rounded-lg">
                          <X className="w-5 h-5 text-rose-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-rose-400 mb-1">Error</h4>
                          <p className="text-rose-300 text-sm">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result Display */}
                  {result && (
                    <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                          <Check className="w-5 h-5" />
                          Result
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={copyResult}
                            disabled={!result}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </button>
                          <button
                            onClick={exportResultAsJson}
                            disabled={!result}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all"
                            title="Download result as a JSON file"
                          >
                            <FileJson className="w-4 h-4" />
                            Export JSON
                          </button>
                          <button
                            onClick={exportResultAsTxt}
                            disabled={!result}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all"
                            title="Download result as a plain text file"
                          >
                            <FileText className="w-4 h-4" />
                            Export TXT
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-700/50">
                        <pre className="text-sm text-emerald-400 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl"></div>
                  <div className="relative p-8 bg-slate-800/50 rounded-full">
                    <Wrench className="w-20 h-20 text-blue-400/50" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-300 mb-3">Select a Tool</h3>
                <p className="text-gray-500 mb-6">
                  Choose a tool from the sidebar or search above to get started
                </p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400">{filteredTools.length} tools available</span>
                  </div>
                  {activeTab === 'favorites' && favorites.length === 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                      <StarOff className="w-4 h-4" />
                      <span>No favorites yet</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Info */}
        {showInfoPanel && selectedTool && (
          <div className="w-80 flex flex-col bg-slate-900/50 backdrop-blur-sm border-l border-slate-800/50 overflow-hidden">
            <div className="p-4 border-b border-slate-800/50">
              <h3 className="font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                Information
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {/* Tool Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-400 text-sm mb-1">About</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {selectedTool.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <Lightbulb className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-purple-400 text-sm mb-1">Tips</h4>
                    <ul className="text-xs text-gray-400 space-y-1 leading-relaxed">
                      <li>• Fill in all required fields marked with *</li>
                      <li>• Results can be copied to clipboard</li>
                      <li>• Add to favorites for quick access</li>
                    </ul>
                  </div>
                </div>

                {/* API Method */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-gray-500 mb-1">API Method</div>
                  <code className="text-xs text-cyan-400 font-mono">{selectedTool.apiMethod}</code>
                </div>

                {/* Recent Usage */}
                {history.filter(h => h.toolId === selectedTool.id).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-400" />
                      Recent Usage
                    </h4>
                    <div className="space-y-1">
                      {history
                        .filter(h => h.toolId === selectedTool.id)
                        .slice(0, 3)
                        .map((h, i) => (
                          <div key={i} className="text-xs text-gray-500 p-2 bg-slate-800/30 rounded">
                            {new Date(h.timestamp).toLocaleString()}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

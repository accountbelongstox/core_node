import React, { useState, useEffect } from 'react';
import { ALL_TOOLS, getToolsByCategory, getAllCategories } from '../../config/tools.config';
import { ToolConfig } from '../../core/types';
import { api } from '../../core/api';
import { useToast } from '../admin';
import {
  Search, Star, Clock, Grid, List, Play, Loader, Copy, Check,
  ChevronRight, Filter, X, BookmarkPlus, History as HistoryIcon,
  Sparkles, Wrench, Hash, Code, Calculator, Globe, Image,
  FileCode, Lock, Database, Network, Type
} from 'lucide-react';

/**
 * Unified IT Tools Dashboard
 *
 * Uses tool configurations from config/tools.config.ts
 * Supports 116+ tools across 10+ categories
 *
 * Features:
 * - Search and filter tools
 * - Category-based organization
 * - Favorites and history
 * - Dynamic form generation from inputSchema
 * - Automatic API calling
 * - Result display and copying
 */

interface ToolHistory {
  toolId: string;
  toolName: string;
  timestamp: number;
  input: any;
  output: any;
}

export function UnifiedToolsPage() {
  // Debug: Log tool count on component mount
  useEffect(() => {
    const toolCount = Object.keys(ALL_TOOLS).length;
    console.log(`[UnifiedToolsPage] Loaded ${toolCount} tools`);
    console.log('[UnifiedToolsPage] ALL_TOOLS keys:', Object.keys(ALL_TOOLS).slice(0, 10), '...');
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Tool execution state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Favorites and history (localStorage)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('unified_tool_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<ToolHistory[]>(() => {
    const saved = localStorage.getItem('unified_tool_history');
    return saved ? JSON.parse(saved) : [];
  });

  const toast = useToast();

  // Get all categories
  const categories = ['all', ...getAllCategories()];

  // Category icons mapping
  const categoryIcons: Record<string, any> = {
    'all': Grid,
    'Crypto & Security': Lock,
    'Converters': Code,
    'Web Development': Globe,
    'Text Processing': Type,
    'Math & Calculation': Calculator,
    'Network Tools': Network,
    'Image Tools': Image,
    'Calculators': Calculator,
    'PDF Tools': FileCode,
    'AI Tools': Sparkles,
    'Server Manager': Wrench,
    'Media Tools': Database
  };

  // Filter tools
  const filteredTools = Object.values(ALL_TOOLS).filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesFavorites = !showFavorites || favorites.includes(tool.id);

    return matchesSearch && matchesCategory && matchesFavorites;
  });

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
        ...prev
      ].slice(0, 50); // Keep last 50
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

  // Handle form input change
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
      // Call API method dynamically
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

  // Copy result to clipboard
  const copyResult = () => {
    if (!result) return;
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Render form field based on schema
  const renderFormField = (fieldName: string, fieldSchema: any) => {
    const value = formData[fieldName] || '';
    const isRequired = selectedTool?.inputSchema.required?.includes(fieldName);

    return (
      <div key={fieldName} className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          {fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          {isRequired && <span className="text-red-400 ml-1">*</span>}
        </label>

        {fieldSchema.enum ? (
          <select
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
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
            min={fieldSchema.min}
            max={fieldSchema.max}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            placeholder={`Enter ${fieldName}`}
          />
        ) : fieldSchema.type === 'boolean' ? (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(fieldName, e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">Enable</span>
          </label>
        ) : fieldSchema.type === 'file' ? (
          <input
            type="file"
            onChange={(e) => handleInputChange(fieldName, e.target.files?.[0])}
            accept={fieldSchema.accept}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            rows={fieldSchema.minLength && fieldSchema.minLength > 100 ? 6 : 3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white resize-none"
            placeholder={`Enter ${fieldName}...`}
          />
        )}

        {fieldSchema.min !== undefined && fieldSchema.max !== undefined && (
          <p className="text-xs text-gray-500">Range: {fieldSchema.min} - {fieldSchema.max}</p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="w-8 h-8 text-blue-500" />
            IT Tools Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            {Object.keys(ALL_TOOLS).length} tools across {categories.length - 1} categories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showHistory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            History ({history.length})
          </button>

          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFavorites ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
            Favorites ({favorites.length})
          </button>

          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white min-w-[200px]"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Tools List */}
        <div className="w-1/3 flex flex-col overflow-hidden">
          <div className="text-sm text-gray-400 mb-3">
            {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} found
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredTools.map(tool => {
              const Icon = categoryIcons[tool.category] || Wrench;
              const isFavorite = favorites.includes(tool.id);
              const isSelected = selectedTool?.id === tool.id;

              return (
                <div
                  key={tool.id}
                  onClick={() => handleToolSelect(tool)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                  } border`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className={`w-5 h-5 mt-1 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{tool.name}</h3>
                        <p className={`text-sm mt-1 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                          {tool.description}
                        </p>
                        <div className={`text-xs mt-2 ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                          {tool.category}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleFavorite(tool.id, e)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tool Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTool ? (
            <div className="h-full flex flex-col bg-gray-800 rounded-lg border border-gray-700">
              {/* Tool Header */}
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-2xl font-bold">{selectedTool.name}</h2>
                <p className="text-gray-400 mt-1">{selectedTool.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full">
                    {selectedTool.category}
                  </span>
                  <span className="text-gray-500">
                    API: {selectedTool.apiMethod}
                  </span>
                </div>
              </div>

              {/* Tool Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Input Form */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Input
                  </h3>

                  {Object.entries(selectedTool.inputSchema.properties || {}).map(([fieldName, fieldSchema]) =>
                    renderFormField(fieldName, fieldSchema)
                  )}
                </div>

                {/* Execute Button */}
                <button
                  onClick={executeTool}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
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
                    </>
                  )}
                </button>

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
                    <h4 className="font-semibold mb-1">Error</h4>
                    <p>{error}</p>
                  </div>
                )}

                {/* Result Display */}
                {result && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-400" />
                        Result
                      </h3>
                      <button
                        onClick={copyResult}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                      <pre className="text-sm text-green-400 overflow-x-auto">
                        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-800 rounded-lg border border-gray-700">
              <Wrench className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-gray-400">No Tool Selected</h3>
              <p className="text-gray-500 mt-2">Select a tool from the list to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  Grid,
  List,
  Code,
  FileText,
  Image,
  Lock,
  Hash,
  Calendar,
  Zap,
  Database,
  Globe,
  Terminal,
  Palette,
  Settings,
  Wrench,
  Calculator,
  Clock,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Language } from '../../types';
import { commonClasses } from '../../styles/theme';

// Tool Types
export interface DevTool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<any>;
  component?: React.ComponentType<any>;
  isFavorite?: boolean;
  tags: string[];
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  count: number;
  color: string;
}

interface DevelopmentToolsProps {
  lang?: Language;
}

// Tool Categories
export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'encoders', name: 'Encoders / Decoders', icon: Code, count: 12, color: 'blue' },
  { id: 'converters', name: 'Converters', icon: Zap, count: 15, color: 'green' },
  { id: 'formatters', name: 'Formatters', icon: FileText, count: 10, color: 'purple' },
  { id: 'generators', name: 'Generators', icon: Wrench, count: 18, color: 'orange' },
  { id: 'text', name: 'Text Tools', icon: FileText, count: 20, color: 'indigo' },
  { id: 'image', name: 'Image Tools', icon: Image, count: 8, color: 'pink' },
  { id: 'crypto', name: 'Cryptography', icon: Lock, count: 12, color: 'red' },
  { id: 'hash', name: 'Hash Functions', icon: Hash, count: 8, color: 'yellow' },
  { id: 'datetime', name: 'Date & Time', icon: Calendar, count: 6, color: 'teal' },
  { id: 'network', name: 'Network Tools', icon: Globe, count: 10, color: 'cyan' },
  { id: 'database', name: 'Database Tools', icon: Database, count: 5, color: 'emerald' },
  { id: 'math', name: 'Math Tools', icon: Calculator, count: 8, color: 'violet' },
  { id: 'color', name: 'Color Tools', icon: Palette, count: 6, color: 'rose' },
  { id: 'regex', name: 'Regular Expression', icon: Terminal, count: 4, color: 'amber' },
  { id: 'web', name: 'Web Development', icon: Globe, count: 12, color: 'lime' },
  { id: 'validators', name: 'Validators', icon: AlertCircle, count: 8, color: 'fuchsia' },
  { id: 'misc', name: 'Miscellaneous', icon: Settings, count: 10, color: 'gray' },
  { id: 'performance', name: 'Performance', icon: Zap, count: 5, color: 'sky' },
  { id: 'time', name: 'Time Utilities', icon: Clock, count: 4, color: 'stone' }
];

// Sample tools - In production, this would come from a comprehensive tool registry
const SAMPLE_TOOLS: Omit<DevTool, 'icon'>[] = [
  // Encoders/Decoders
  { id: 'base64-encode', name: 'Base64 Encoder', description: 'Encode text to Base64', category: 'encoders', tags: ['base64', 'encode'] },
  { id: 'base64-decode', name: 'Base64 Decoder', description: 'Decode Base64 to text', category: 'encoders', tags: ['base64', 'decode'] },
  { id: 'url-encode', name: 'URL Encoder', description: 'Encode URL components', category: 'encoders', tags: ['url', 'encode'] },
  { id: 'url-decode', name: 'URL Decoder', description: 'Decode URL components', category: 'encoders', tags: ['url', 'decode'] },
  { id: 'html-encode', name: 'HTML Encoder', description: 'Encode HTML entities', category: 'encoders', tags: ['html', 'encode'] },
  { id: 'html-decode', name: 'HTML Decoder', description: 'Decode HTML entities', category: 'encoders', tags: ['html', 'decode'] },
  { id: 'jwt-decode', name: 'JWT Decoder', description: 'Decode JWT tokens', category: 'encoders', tags: ['jwt', 'token'] },
  { id: 'unicode-encode', name: 'Unicode Encoder', description: 'Encode to Unicode', category: 'encoders', tags: ['unicode'] },

  // Converters
  { id: 'json-yaml', name: 'JSON to YAML', description: 'Convert JSON to YAML format', category: 'converters', tags: ['json', 'yaml'] },
  { id: 'yaml-json', name: 'YAML to JSON', description: 'Convert YAML to JSON format', category: 'converters', tags: ['yaml', 'json'] },
  { id: 'csv-json', name: 'CSV to JSON', description: 'Convert CSV to JSON', category: 'converters', tags: ['csv', 'json'] },
  { id: 'xml-json', name: 'XML to JSON', description: 'Convert XML to JSON', category: 'converters', tags: ['xml', 'json'] },
  { id: 'markdown-html', name: 'Markdown to HTML', description: 'Convert Markdown to HTML', category: 'converters', tags: ['markdown', 'html'] },
  { id: 'timestamp-date', name: 'Timestamp Converter', description: 'Convert Unix timestamps', category: 'converters', tags: ['timestamp', 'date'] },
  { id: 'number-base', name: 'Number Base Converter', description: 'Convert between number bases', category: 'converters', tags: ['number', 'base'] },
  { id: 'unit-converter', name: 'Unit Converter', description: 'Convert units of measurement', category: 'converters', tags: ['units'] },

  // Formatters
  { id: 'json-formatter', name: 'JSON Formatter', description: 'Format and beautify JSON', category: 'formatters', tags: ['json', 'format'] },
  { id: 'xml-formatter', name: 'XML Formatter', description: 'Format and beautify XML', category: 'formatters', tags: ['xml', 'format'] },
  { id: 'sql-formatter', name: 'SQL Formatter', description: 'Format SQL queries', category: 'formatters', tags: ['sql', 'format'] },
  { id: 'css-formatter', name: 'CSS Formatter', description: 'Format CSS code', category: 'formatters', tags: ['css', 'format'] },
  { id: 'html-formatter', name: 'HTML Formatter', description: 'Format HTML code', category: 'formatters', tags: ['html', 'format'] },
  { id: 'js-formatter', name: 'JavaScript Formatter', description: 'Format JavaScript code', category: 'formatters', tags: ['javascript', 'format'] },

  // Generators
  { id: 'uuid-generator', name: 'UUID Generator', description: 'Generate UUIDs', category: 'generators', tags: ['uuid', 'guid'] },
  { id: 'password-generator', name: 'Password Generator', description: 'Generate secure passwords', category: 'generators', tags: ['password', 'security'] },
  { id: 'lorem-ipsum', name: 'Lorem Ipsum Generator', description: 'Generate placeholder text', category: 'generators', tags: ['lorem', 'text'] },
  { id: 'qr-code', name: 'QR Code Generator', description: 'Generate QR codes', category: 'generators', tags: ['qr', 'code'] },
  { id: 'hash-generator', name: 'Hash Generator', description: 'Generate various hashes', category: 'generators', tags: ['hash', 'crypto'] },
  { id: 'random-data', name: 'Random Data Generator', description: 'Generate random test data', category: 'generators', tags: ['random', 'data'] },

  // Text Tools
  { id: 'word-counter', name: 'Word Counter', description: 'Count words and characters', category: 'text', tags: ['word', 'count'] },
  { id: 'case-converter', name: 'Case Converter', description: 'Convert text case', category: 'text', tags: ['case', 'text'] },
  { id: 'text-diff', name: 'Text Diff', description: 'Compare text differences', category: 'text', tags: ['diff', 'compare'] },
  { id: 'string-escape', name: 'String Escape', description: 'Escape/unescape strings', category: 'text', tags: ['escape', 'string'] },
  { id: 'regex-tester', name: 'Regex Tester', description: 'Test regular expressions', category: 'text', tags: ['regex', 'test'] },
  { id: 'sort-lines', name: 'Sort Lines', description: 'Sort text lines', category: 'text', tags: ['sort', 'lines'] },

  // Image Tools
  { id: 'image-compress', name: 'Image Compressor', description: 'Compress images', category: 'image', tags: ['image', 'compress'] },
  { id: 'image-resize', name: 'Image Resizer', description: 'Resize images', category: 'image', tags: ['image', 'resize'] },
  { id: 'image-convert', name: 'Image Converter', description: 'Convert image formats', category: 'image', tags: ['image', 'convert'] },
  { id: 'base64-image', name: 'Base64 Image', description: 'Convert image to Base64', category: 'image', tags: ['image', 'base64'] },

  // Cryptography
  { id: 'aes-encrypt', name: 'AES Encryption', description: 'Encrypt with AES', category: 'crypto', tags: ['aes', 'encrypt'] },
  { id: 'rsa-encrypt', name: 'RSA Encryption', description: 'Encrypt with RSA', category: 'crypto', tags: ['rsa', 'encrypt'] },
  { id: 'hash-md5', name: 'MD5 Hash', description: 'Generate MD5 hash', category: 'hash', tags: ['md5', 'hash'] },
  { id: 'hash-sha256', name: 'SHA-256 Hash', description: 'Generate SHA-256 hash', category: 'hash', tags: ['sha256', 'hash'] },

  // Date & Time
  { id: 'date-calculator', name: 'Date Calculator', description: 'Calculate date differences', category: 'datetime', tags: ['date', 'calculate'] },
  { id: 'timezone-converter', name: 'Timezone Converter', description: 'Convert timezones', category: 'datetime', tags: ['timezone', 'convert'] },
  { id: 'cron-parser', name: 'Cron Expression Parser', description: 'Parse cron expressions', category: 'datetime', tags: ['cron', 'parse'] },

  // Network Tools
  { id: 'ip-lookup', name: 'IP Lookup', description: 'Lookup IP information', category: 'network', tags: ['ip', 'lookup'] },
  { id: 'dns-lookup', name: 'DNS Lookup', description: 'Lookup DNS records', category: 'network', tags: ['dns', 'lookup'] },
  { id: 'port-scanner', name: 'Port Scanner', description: 'Scan network ports', category: 'network', tags: ['port', 'scan'] },
  { id: 'ping-tool', name: 'Ping Tool', description: 'Ping network hosts', category: 'network', tags: ['ping', 'network'] },

  // Math Tools
  { id: 'calculator', name: 'Calculator', description: 'Basic calculator', category: 'math', tags: ['calculate', 'math'] },
  { id: 'percentage', name: 'Percentage Calculator', description: 'Calculate percentages', category: 'math', tags: ['percentage', 'math'] },
  { id: 'base-converter', name: 'Base Converter', description: 'Convert number bases', category: 'math', tags: ['base', 'convert'] },

  // Color Tools
  { id: 'color-picker', name: 'Color Picker', description: 'Pick and convert colors', category: 'color', tags: ['color', 'picker'] },
  { id: 'gradient-generator', name: 'Gradient Generator', description: 'Generate CSS gradients', category: 'color', tags: ['gradient', 'css'] },

  // Validators
  { id: 'json-validator', name: 'JSON Validator', description: 'Validate JSON syntax', category: 'validators', tags: ['json', 'validate'] },
  { id: 'xml-validator', name: 'XML Validator', description: 'Validate XML syntax', category: 'validators', tags: ['xml', 'validate'] },
  { id: 'email-validator', name: 'Email Validator', description: 'Validate email addresses', category: 'validators', tags: ['email', 'validate'] },
];

const DevelopmentTools: React.FC<DevelopmentToolsProps> = ({ lang = 'en' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<DevTool | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tools, setTools] = useState<DevTool[]>([]);

  useEffect(() => {
    // Load tools with icons
    const toolsWithIcons: DevTool[] = SAMPLE_TOOLS.map(tool => ({
      ...tool,
      icon: getCategoryIcon(tool.category),
      isFavorite: favorites.includes(tool.id)
    }));
    setTools(toolsWithIcons);
  }, [favorites]);

  useEffect(() => {
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('dev_tools_favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const getCategoryIcon = (categoryId: string) => {
    const category = TOOL_CATEGORIES.find(c => c.id === categoryId);
    return category?.icon || Wrench;
  };

  const toggleFavorite = (toolId: string) => {
    const newFavorites = favorites.includes(toolId)
      ? favorites.filter(id => id !== toolId)
      : [...favorites, toolId];
    setFavorites(newFavorites);
    localStorage.setItem('dev_tools_favorites', JSON.stringify(newFavorites));
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory ||
      (selectedCategory === 'favorites'
        ? favorites.includes(tool.id)
        : tool.category === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (categoryId: string): string => {
    const category = TOOL_CATEGORIES.find(c => c.id === categoryId);
    return category?.color || 'gray';
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
      cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
      emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
      rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      lime: 'bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400',
      fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400',
      gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
      sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
      stone: 'bg-stone-100 dark:bg-stone-900/30 text-stone-600 dark:text-stone-400',
    };
    return colorMap[color] || colorMap.gray;
  };

  if (selectedTool) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTool(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              ← Back
            </button>
            <div className={`p-3 rounded-lg ${getColorClasses(getCategoryColor(selectedTool.category))}`}>
              <selectedTool.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedTool.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedTool.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleFavorite(selectedTool.id)}
            className={`p-2 rounded-lg ${
              favorites.includes(selectedTool.id)
                ? 'text-yellow-500'
                : 'text-gray-400 hover:text-yellow-500'
            }`}
          >
            <Star className={`w-6 h-6 ${favorites.includes(selectedTool.id) ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className={`flex-1 ${commonClasses.card} p-6 overflow-auto`}>
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
              Tool implementation coming soon
            </p>
            <p className="text-sm text-gray-500">
              This is a placeholder. Each tool will have its own specialized interface.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Development Tools
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A collection of 100+ tools for developers
        </p>
      </div>

      {/* Search and View Controls */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className={`${commonClasses.input} pl-10`}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${
              viewMode === 'grid'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              viewMode === 'list'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                selectedCategory === null
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5" />
                <span className="font-medium">All Tools</span>
              </div>
              <span className="text-sm">{tools.length}</span>
            </button>

            {favorites.length > 0 && (
              <button
                onClick={() => setSelectedCategory('favorites')}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedCategory === 'favorites'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="font-medium">Favorites</span>
                </div>
                <span className="text-sm">{favorites.length}</span>
              </button>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

            {TOOL_CATEGORIES.map(category => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? `${getColorClasses(category.color)}`
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm truncate">{category.name}</span>
                  </div>
                  <span className="text-sm flex-shrink-0 ml-2">{category.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools Grid/List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTools.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  No tools found
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your search or category filter
                </p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map(tool => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    className={`${commonClasses.card} p-4 cursor-pointer hover:shadow-lg transition-shadow relative group`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(tool.id);
                      }}
                      className={`absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity ${
                        favorites.includes(tool.id) ? 'opacity-100 text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(tool.id) ? 'fill-current' : ''}`} />
                    </button>
                    <div className={`w-12 h-12 rounded-lg ${getColorClasses(getCategoryColor(tool.category))} flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {tool.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {tool.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTools.map(tool => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    className={`${commonClasses.card} p-4 cursor-pointer hover:shadow-lg transition-shadow flex items-center gap-4 group`}
                  >
                    <div className={`w-12 h-12 rounded-lg ${getColorClasses(getCategoryColor(tool.category))} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {tool.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(tool.id);
                        }}
                        className={`p-2 ${
                          favorites.includes(tool.id) ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${favorites.includes(tool.id) ? 'fill-current' : ''}`} />
                      </button>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevelopmentTools;

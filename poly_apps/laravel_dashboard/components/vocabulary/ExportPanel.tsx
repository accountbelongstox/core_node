import React, { useState } from 'react';
import {
  Download,
  FileText,
  FileJson,
  File,
  CheckCircle,
  Loader2,
  Settings,
  Filter
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';

interface ExportPanelProps {
  userId?: string;
}

type ExportFormat = 'csv' | 'json' | 'anki' | 'pdf' | 'txt';
type ExportScope = 'all' | 'learned' | 'review' | 'library';

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  includeExamples: boolean;
  includePhonetics: boolean;
  includeDefinitions: boolean;
  libraryId?: string;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ userId }) => {
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    scope: 'all',
    includeExamples: true,
    includePhonetics: true,
    includeDefinitions: true
  });
  const [libraries, setLibraries] = useState<any[]>([]);

  const formatInfo = {
    csv: {
      icon: FileText,
      name: 'CSV (Comma-Separated Values)',
      description: 'Spreadsheet format compatible with Excel, Google Sheets',
      color: 'text-green-600'
    },
    json: {
      icon: FileJson,
      name: 'JSON',
      description: 'Machine-readable format for developers and data processing',
      color: 'text-blue-600'
    },
    anki: {
      icon: File,
      name: 'Anki Deck',
      description: 'Import directly into Anki flashcard application',
      color: 'text-purple-600'
    },
    pdf: {
      icon: FileText,
      name: 'PDF Document',
      description: 'Printable format with formatted vocabulary list',
      color: 'text-red-600'
    },
    txt: {
      icon: FileText,
      name: 'Plain Text',
      description: 'Simple text format for basic vocabulary list',
      color: 'text-gray-600'
    }
  };

  const scopeInfo = {
    all: 'All vocabulary words in your collection',
    learned: 'Only words marked as learned',
    review: 'Only words due for review',
    library: 'Words from a specific library'
  };

  const handleExport = async () => {
    setExporting(true);
    setExportComplete(false);

    try {
      // Call export API based on format
      let result;
      switch (options.format) {
        case 'csv':
          result = await apiService.appQyV1.exportToCSV(options);
          break;
        case 'json':
          result = await apiService.appQyV1.exportToJSON(options);
          break;
        case 'anki':
          result = await apiService.appQyV1.exportToAnki(options);
          break;
        case 'pdf':
          result = await apiService.appQyV1.exportToPDF(options);
          break;
        case 'txt':
          result = await apiService.appQyV1.exportToText(options);
          break;
      }

      // Trigger download
      if (result && result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.filename || `vocabulary_export.${options.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Export Vocabulary
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Download your vocabulary data in various formats
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Format Selection */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Format
            </h3>
            <div className="space-y-3">
              {Object.entries(formatInfo).map(([format, info]) => {
                const Icon = info.icon;
                const isSelected = options.format === format;

                return (
                  <button
                    key={format}
                    onClick={() => setOptions(prev => ({ ...prev, format: format as ExportFormat }))}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-6 h-6 flex-shrink-0 ${info.color}`} />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {info.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {info.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selection */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Export Scope
            </h3>
            <div className="space-y-3">
              {Object.entries(scopeInfo).map(([scope, description]) => {
                const isSelected = options.scope === scope;

                return (
                  <label
                    key={scope}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={scope}
                      checked={isSelected}
                      onChange={(e) => setOptions(prev => ({ ...prev, scope: e.target.value as ExportScope }))}
                      className="mt-1"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                        {scope.replace('_', ' ')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {options.scope === 'library' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Library
                </label>
                <select
                  value={options.libraryId || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, libraryId: e.target.value }))}
                  className={commonClasses.input}
                >
                  <option value="">Choose a library...</option>
                  <option value="lib_1">Business English</option>
                  <option value="lib_2">Academic Vocabulary</option>
                  <option value="lib_3">Daily Conversation</option>
                </select>
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Additional Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Example Sentences
                </span>
                <input
                  type="checkbox"
                  checked={options.includeExamples}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeExamples: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Phonetic Transcriptions
                </span>
                <input
                  type="checkbox"
                  checked={options.includePhonetics}
                  onChange={(e) => setOptions(prev => ({ ...prev, includePhonetics: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Definitions
                </span>
                <input
                  type="checkbox"
                  checked={options.includeDefinitions}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeDefinitions: e.target.checked }))}
                  className="w-5 h-5"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Export Summary & Action */}
        <div className="space-y-6">
          <div className={`${commonClasses.card} p-6 sticky top-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Summary
            </h3>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Format:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatInfo[options.format].name.split(' ')[0]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Scope:</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {options.scope.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Examples:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includeExamples ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Phonetics:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includePhonetics ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Definitions:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.includeDefinitions ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || (options.scope === 'library' && !options.libraryId)}
              className={`w-full ${commonClasses.button} ${
                exportComplete
                  ? 'bg-green-600 hover:bg-green-700'
                  : commonClasses.buttonPrimary
              } text-white flex items-center justify-center gap-2 py-3`}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exporting...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Export Complete!
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export Now
                </>
              )}
            </button>

            {options.scope === 'library' && !options.libraryId && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">
                Please select a library to export
              </p>
            )}
          </div>

          {/* Export History */}
          <div className={`${commonClasses.card} p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Exports
            </h3>
            <div className="space-y-3">
              {[
                { format: 'csv', date: '2025-12-12', size: '2.4 MB' },
                { format: 'json', date: '2025-12-10', size: '3.1 MB' },
                { format: 'anki', date: '2025-12-08', size: '1.8 MB' }
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.format.toUpperCase()} Export
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {item.date} • {item.size}
                      </p>
                    </div>
                  </div>
                  <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;

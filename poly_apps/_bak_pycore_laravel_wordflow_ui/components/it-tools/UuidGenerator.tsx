'use client';

import React, { useState } from 'react';
import { itToolsModel } from '../../core/models';
import { useToolOperation, useClipboard } from '../../hooks';
import { ToolContainer, CodeDisplay, CopyAllButton } from '../common';
import { RefreshCw } from 'lucide-react';

export function UuidGenerator() {
  const [version, setVersion] = useState<number>(4);
  const [count, setCount] = useState(1);
  const { loading, result, execute } = useToolOperation();
  const { copy, copyMultiple } = useClipboard();

  const handleGenerate = () => {
    execute(() => itToolsModel.crypto.uuid(count), {
      successMessage: `${count} UUID${count > 1 ? 's' : ''} generated`
    });
  };

  const handleGenerateUlid = () => {
    execute(() => itToolsModel.crypto.ulid(1), {
      successMessage: 'ULID generated successfully'
    });
  };

  const uuids = result ? (result.uuids || (result.uuid ? [result.uuid] : result.ulids ? result.ulids : [])) : [];
  const singleResult = uuids.length === 1 ? uuids[0] : '';

  return (
    <ToolContainer
      title="UUID Generator"
      description="Generate UUIDs (v1, v4, v5) and ULIDs"
    >
      <div className="space-y-4">
          {/* Version Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UUID Version
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => setVersion(1)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  version === 1
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                UUID v1
              </button>
              <button
                onClick={() => setVersion(4)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  version === 4
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                UUID v4
              </button>
              <button
                onClick={() => setVersion(5)}
                className={`px-4 py-2 border rounded-lg transition-colors ${
                  version === 5
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                UUID v5
              </button>
              <button
                onClick={handleGenerateUlid}
                disabled={loading}
                className="px-4 py-2 border rounded-lg transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                ULID
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              <p><strong>v1:</strong> Timestamp-based (includes MAC address)</p>
              <p><strong>v4:</strong> Random (most common)</p>
              <p><strong>v5:</strong> Namespace + Name based (SHA-1)</p>
              <p><strong>ULID:</strong> Lexicographically sortable, timestamp-based</p>
            </div>
          </div>

          {/* Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How many UUIDs?
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              min={1}
              max={100}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum: 100</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </button>

          </div>

          {singleResult && <CodeDisplay value={singleResult} label="Generated UUID" />}

          {uuids.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Generated UUIDs ({uuids.length})
                </label>
                <CopyAllButton
                  items={uuids}
                  label="Copy All"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline !px-0 !py-0"
                  showIcon={false}
                  successMessage={`${uuids.length} UUIDs copied to clipboard`}
                />
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {uuids.map((uuid, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-750 group"
                    >
                      <span className="font-mono text-sm flex-1">{uuid}</span>
                      <button
                        onClick={() => copy(uuid)}
                        className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
    </ToolContainer>
  );
}

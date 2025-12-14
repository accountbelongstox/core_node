'use client';

import React, { useState } from 'react';
import { api } from '@/core/api';
import { useToast } from '@/components/admin';
import { Copy, RefreshCw } from 'lucide-react';

/**
 * UUID Generator Tool
 *
 * Generate UUIDs with different versions:
 * - UUID v1 (timestamp-based)
 * - UUID v4 (random)
 * - UUID v5 (namespace + name)
 * - ULID (Universally Unique Lexicographically Sortable Identifier)
 */
export function UuidGenerator() {
  const [version, setVersion] = useState<number>(4);
  const [result, setResult] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleGenerate() {
    setLoading(true);
    try {
      const generated: string[] = [];

      for (let i = 0; i < count; i++) {
        const res = await api.itToolsV1.generateUuid({ version });
        if (res.success) {
          generated.push(res.data.uuid);
        }
      }

      if (generated.length === 1) {
        setResult(generated[0]);
        setResults([]);
      } else {
        setResults(generated);
        setResult('');
      }

      toast.success(`${generated.length} UUID${generated.length > 1 ? 's' : ''} generated`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate UUID');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateUlid() {
    setLoading(true);
    try {
      const res = await api.itToolsV1.generateUlid();
      if (res.success) {
        setResult(res.data.ulid);
        setResults([]);
        toast.success('ULID generated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate ULID');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  async function handleCopyAll() {
    if (results.length > 0) {
      await navigator.clipboard.writeText(results.join('\n'));
      toast.success(`Copied ${results.length} UUIDs`);
    } else if (result) {
      await navigator.clipboard.writeText(result);
      toast.success('Copied to clipboard');
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">UUID Generator</h2>
          <p className="text-gray-600 mt-1">
            Generate UUIDs (v1, v4, v5) and ULIDs
          </p>
        </div>

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

            {(result || results.length > 0) && (
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Copy className="w-4 h-4" />
                Copy All
              </button>
            )}
          </div>

          {/* Single Result */}
          {result && !results.length && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated UUID
              </label>
              <div className="relative">
                <div className="bg-gray-50 border rounded-lg p-4 pr-12 font-mono text-sm break-all">
                  {result}
                </div>
                <button
                  onClick={() => handleCopy(result)}
                  className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}

          {/* Multiple Results */}
          {results.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated UUIDs ({results.length})
              </label>
              <div className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {results.map((uuid, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white border rounded p-2 hover:bg-gray-50 group"
                    >
                      <span className="font-mono text-sm flex-1">{uuid}</span>
                      <button
                        onClick={() => handleCopy(uuid)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                        title="Copy"
                      >
                        <Copy className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

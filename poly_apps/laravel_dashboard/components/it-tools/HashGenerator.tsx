'use client';

import React, { useState } from 'react';
import { api } from '@/core/api';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import { Copy, RefreshCw } from 'lucide-react';

/**
 * Hash Generator Tool
 *
 * Generate hash using various algorithms:
 * - MD5
 * - SHA-1
 * - SHA-256
 * - SHA-512
 * - And more
 */
export function HashGenerator() {
  const [input, setInput] = useState('');
  const [algorithm, setAlgorithm] = useState('sha256');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  const algorithms = [
    { value: 'md5', label: 'MD5' },
    { value: 'sha1', label: 'SHA-1' },
    { value: 'sha256', label: 'SHA-256' },
    { value: 'sha512', label: 'SHA-512' },
    { value: 'sha3-256', label: 'SHA3-256' },
    { value: 'sha3-512', label: 'SHA3-512' }
  ];

  async function handleGenerate() {
    if (!input) {
      toast.warning(t('form.required'));
      return;
    }

    setLoading(true);
    try {
      const res = await api.itToolsV1.hash({ algorithm, input });
      if (res.success) {
        setResult(res.data.hash);
        toast.success('Hash generated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate hash');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast.success(t('messages.copySuccess'));
  }

  function handleClear() {
    setInput('');
    setResult('');
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hash Generator</h2>
          <p className="text-gray-600 mt-1">
            Generate hash using various algorithms (MD5, SHA-1, SHA-256, etc.)
          </p>
        </div>

        <div className="space-y-4">
          {/* Algorithm Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Algorithm
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {algorithms.map((algo) => (
                <button
                  key={algo.value}
                  onClick={() => setAlgorithm(algo.value)}
                  className={`px-4 py-2 border rounded-lg transition-colors ${
                    algorithm === algo.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {algo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Text
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text to hash..."
              rows={6}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !input}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Hash'
              )}
            </button>

            <button
              onClick={handleClear}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>

          {/* Result */}
          {result && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Result
              </label>
              <div className="relative">
                <div className="bg-gray-50 border rounded-lg p-4 pr-12 font-mono text-sm break-all">
                  {result}
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

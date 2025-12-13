'use client';

import React, { useState } from 'react';
import { api } from '@/core/api';
import { useToast } from '@/components/admin';
import { Copy, Minimize2, Maximize2 } from 'lucide-react';

/**
 * JSON Formatter Tool
 *
 * Format, validate, and minify JSON:
 * - Prettify JSON with custom indentation
 * - Minify JSON
 * - Validate JSON syntax
 * - Copy formatted result
 */
export function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handlePrettify() {
    if (!input.trim()) {
      toast.warning('Please enter JSON to format');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.itToolsV1.jsonPrettify({
        json: input,
        indent
      });

      if (res.success) {
        setOutput(res.data.formatted);
        toast.success('JSON formatted successfully');
      }
    } catch (error: any) {
      setError(error.message || 'Invalid JSON');
      toast.error('Failed to format JSON');
    } finally {
      setLoading(false);
    }
  }

  async function handleMinify() {
    if (!input.trim()) {
      toast.warning('Please enter JSON to minify');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.itToolsV1.jsonMinify({ json: input });

      if (res.success) {
        setOutput(res.data.minified);
        toast.success('JSON minified successfully');
      }
    } catch (error: any) {
      setError(error.message || 'Invalid JSON');
      toast.error('Failed to minify JSON');
    } finally {
      setLoading(false);
    }
  }

  function handleValidate() {
    if (!input.trim()) {
      toast.warning('Please enter JSON to validate');
      return;
    }

    setError('');
    try {
      JSON.parse(input);
      toast.success('Valid JSON!', 'Syntax is correct');
    } catch (error: any) {
      setError(error.message);
      toast.error('Invalid JSON', error.message);
    }
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast.success('Copied to clipboard');
  }

  function handleClear() {
    setInput('');
    setOutput('');
    setError('');
  }

  function handleSwap() {
    if (output) {
      setInput(output);
      setOutput('');
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">JSON Formatter</h2>
          <p className="text-gray-600 mt-1">
            Prettify, minify, and validate JSON
          </p>
        </div>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrettify}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Maximize2 className="w-4 h-4" />
                Prettify
              </button>

              <button
                onClick={handleMinify}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Minimize2 className="w-4 h-4" />
                Minify
              </button>

              <button
                onClick={handleValidate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Validate
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Indent:</label>
                <select
                  value={indent}
                  onChange={(e) => setIndent(parseInt(e.target.value))}
                  className="px-3 py-1 border rounded"
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={8}>8 spaces</option>
                </select>
              </div>

              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Input/Output Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Input JSON
                </label>
                <span className="text-xs text-gray-500">
                  {input.length} characters
                </span>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='{"key": "value"}'
                rows={20}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            {/* Output */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Output
                </label>
                <div className="flex items-center gap-2">
                  {output && (
                    <>
                      <span className="text-xs text-gray-500">
                        {output.length} characters
                      </span>
                      <button
                        onClick={handleSwap}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Use as input
                      </button>
                      <button
                        onClick={handleCopy}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <textarea
                value={output}
                readOnly
                placeholder="Formatted JSON will appear here..."
                rows={20}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

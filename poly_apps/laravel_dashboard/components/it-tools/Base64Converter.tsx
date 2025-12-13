'use client';

import React, { useState } from 'react';
import { api } from '@/core/api';
import { useToast } from '@/components/admin';
import { Copy, ArrowRight, ArrowLeft } from 'lucide-react';

/**
 * Base64 Converter Tool
 *
 * Encode and decode Base64 strings:
 * - Text to Base64
 * - Base64 to Text
 * - File to Base64
 * - Base64 to File
 */
export function Base64Converter() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleEncode() {
    if (!input.trim()) {
      toast.warning('Please enter text to encode');
      return;
    }

    setLoading(true);
    try {
      const res = await api.itToolsV1.base64Encode({ text: input });
      if (res.success) {
        setOutput(res.data.encoded);
        toast.success('Text encoded successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to encode');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecode() {
    if (!input.trim()) {
      toast.warning('Please enter Base64 to decode');
      return;
    }

    setLoading(true);
    try {
      const res = await api.itToolsV1.base64Decode({ text: input });
      if (res.success) {
        setOutput(res.data.decoded);
        toast.success('Base64 decoded successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to decode');
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert() {
    if (mode === 'encode') {
      await handleEncode();
    } else {
      await handleDecode();
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  function handleClear() {
    setInput('');
    setOutput('');
  }

  function handleSwap() {
    const newMode = mode === 'encode' ? 'decode' : 'encode';
    setMode(newMode);
    if (output) {
      setInput(output);
      setOutput('');
    }
  }

  async function handleFileEncode(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const res = await api.itToolsV1.base64FileEncode({ file });
      if (res.success) {
        setOutput(res.data.encoded);
        setInput(file.name);
        toast.success('File encoded to Base64');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to encode file');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Base64 Converter</h2>
          <p className="text-gray-600 mt-1">
            Encode and decode Base64 strings
          </p>
        </div>

        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setMode('encode')}
              className={`px-6 py-2 border rounded-lg transition-colors ${
                mode === 'encode'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Encode
            </button>

            <button
              onClick={handleSwap}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Swap"
            >
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </button>

            <button
              onClick={() => setMode('decode')}
              className={`px-6 py-2 border rounded-lg transition-colors ${
                mode === 'decode'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Decode
            </button>
          </div>

          {/* File Upload (Encode Only) */}
          {mode === 'encode' && (
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                onChange={handleFileEncode}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer"
              >
                <div className="text-gray-600">
                  <p className="font-medium">Upload a file to encode</p>
                  <p className="text-sm mt-1">Click to select or drag and drop</p>
                </div>
              </label>
            </div>
          )}

          {/* Input/Output Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {mode === 'encode' ? 'Plain Text' : 'Base64'}
                </label>
                <span className="text-xs text-gray-500">
                  {input.length} characters
                </span>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 to decode...'}
                rows={16}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            {/* Output */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {mode === 'encode' ? 'Base64' : 'Plain Text'}
                </label>
                <div className="flex items-center gap-2">
                  {output && (
                    <>
                      <span className="text-xs text-gray-500">
                        {output.length} characters
                      </span>
                      <button
                        onClick={() => handleCopy(output)}
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
                placeholder="Result will appear here..."
                rows={16}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleConvert}
              disabled={loading || !input.trim()}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : mode === 'encode' ? 'Encode' : 'Decode'}
            </button>

            <button
              onClick={handleClear}
              className="px-8 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

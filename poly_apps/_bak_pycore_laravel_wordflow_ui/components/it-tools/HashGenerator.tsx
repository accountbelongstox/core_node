'use client';

import React, { useState } from 'react';
import { itToolsModel } from '../../core/models';
import { useToolOperation } from '../../hooks';
import { ToolContainer, TextAreaInput, CodeDisplay } from '../common';
import { RefreshCw } from 'lucide-react';

export function HashGenerator() {
  const [input, setInput] = useState('');
  const [algorithm, setAlgorithm] = useState('sha256');
  const { loading, result, execute } = useToolOperation();

  const algorithms = [
    { value: 'md5', label: 'MD5' },
    { value: 'sha1', label: 'SHA-1' },
    { value: 'sha256', label: 'SHA-256' },
    { value: 'sha512', label: 'SHA-512' }
  ];

  const handleGenerate = () => {
    execute(() => itToolsModel.crypto.hash(input, algorithm), {
      validateInput: () => input ? true : 'Please enter text to hash',
      successMessage: 'Hash generated successfully'
    });
  };

  const hash = result ? (result.hash || '') : '';

  return (
    <ToolContainer
      title="Hash Generator"
      description="Generate hash using various algorithms (MD5, SHA-1, SHA-256, etc.)"
    >
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

          <TextAreaInput
            value={input}
            onChange={setInput}
            label="Input Text"
            placeholder="Enter text to hash..."
            rows={6}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !input}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
          </div>

          {hash && <CodeDisplay value={hash} label="Result" />}
        </div>
    </ToolContainer>
  );
}

'use client';

import React, { useState } from 'react';
import { itToolsModel } from '../../core/models';
import { useToolOperation } from '../../hooks';
import { useToast } from '../admin';
import { ToolContainer, TextAreaInput, CodeDisplay } from '../common';
import { Minimize2, Maximize2 } from 'lucide-react';

export function JsonFormatter() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState(2);
  const { loading, result, error, execute, setResult } = useToolOperation();
  const [validationError, setValidationError] = useState('');
  const toast = useToast();

  const handlePrettify = () => {
    setValidationError('');
    execute(() => itToolsModel.converter.json.prettify(input, indent), {
      validateInput: () => input.trim() ? true : 'Please enter JSON to format',
      successMessage: 'JSON formatted successfully'
    });
  };

  const handleMinify = () => {
    setValidationError('');
    execute(() => itToolsModel.converter.json.minify(input), {
      validateInput: () => input.trim() ? true : 'Please enter JSON to minify',
      successMessage: 'JSON minified successfully'
    });
  };

  // Client-side validity check (no backend round-trip needed).
  const handleValidate = () => {
    if (!input.trim()) {
      setValidationError('Please enter JSON to validate');
      return;
    }
    try {
      JSON.parse(input);
      setValidationError('');
      toast.success('Valid JSON');
    } catch (err: any) {
      setValidationError(err?.message ? `Invalid JSON: ${err.message}` : 'Invalid JSON');
    }
  };

  const handleSwap = () => {
    if (result) {
      setInput(result.prettified || result.minified || '');
      setResult(null);
    }
  };

  const output = result ? (result.prettified || result.minified || '') : '';

  return (
    <ToolContainer
      title="JSON Formatter"
      description="Prettify, minify, and validate JSON"
      maxWidth="6xl"
    >
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

            </div>
          </div>

          {(error || validationError) && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
              <strong>Error:</strong> {error || validationError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TextAreaInput
              value={input}
              onChange={setInput}
              label="Input JSON"
              placeholder='{"key": "value"}'
              rows={20}
            />

            {output ? (
              <div>
                <div className="flex items-center justify-end gap-2 mb-2">
                  <button
                    onClick={handleSwap}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Use as input
                  </button>
                </div>
                <CodeDisplay value={output} label="Output" />
              </div>
            ) : (
              <TextAreaInput
                value=""
                onChange={() => {}}
                label="Output"
                placeholder="Formatted JSON will appear here..."
                rows={20}
                readOnly
              />
            )}
          </div>
        </div>
    </ToolContainer>
  );
}

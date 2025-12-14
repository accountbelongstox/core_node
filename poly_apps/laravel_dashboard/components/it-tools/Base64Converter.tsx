'use client';

import React, { useState } from 'react';
import { itToolsModel } from '../../core/models';
import { useToolOperation, useClipboard } from '../../hooks';
import { ToolContainer, TextAreaInput, CodeDisplay } from '../common';
import { ArrowRight } from 'lucide-react';

export function Base64Converter() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const { loading, result, execute, setResult } = useToolOperation();
  const { copy } = useClipboard();

  const handleConvert = () => {
    const operation = mode === 'encode'
      ? () => itToolsModel.converter.base64.encode(input)
      : () => itToolsModel.converter.base64.decode(input);

    execute(operation, {
      validateInput: () => input.trim() ? true : `Please enter ${mode === 'encode' ? 'text' : 'Base64'} to ${mode}`,
      successMessage: `${mode === 'encode' ? 'Encoded' : 'Decoded'} successfully`
    });
  };

  const handleClear = () => {
    setInput('');
    setResult(null);
  };

  const handleSwap = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    if (result) {
      setInput(result.encoded || result.decoded || '');
      setResult(null);
    }
  };

  const output = result ? (result.encoded || result.decoded || '') : '';

  return (
    <ToolContainer
      title="Base64 Converter"
      description="Encode and decode Base64 strings"
      maxWidth="6xl"
    >
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TextAreaInput
              value={input}
              onChange={setInput}
              label={mode === 'encode' ? 'Plain Text' : 'Base64'}
              placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 to decode...'}
              rows={16}
            />

            {output ? (
              <CodeDisplay
                value={output}
                label={mode === 'encode' ? 'Base64' : 'Plain Text'}
              />
            ) : (
              <TextAreaInput
                value=""
                onChange={() => {}}
                label={mode === 'encode' ? 'Base64' : 'Plain Text'}
                placeholder="Result will appear here..."
                rows={16}
                readOnly
              />
            )}
          </div>

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
              className="px-8 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
    </ToolContainer>
  );
}

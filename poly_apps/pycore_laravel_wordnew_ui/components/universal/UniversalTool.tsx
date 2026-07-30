import React, { useState } from 'react';
import { useToolModel } from '../../hooks';
import { ToolDefinition } from '../../core/types';
import ToolWrapper from './ToolWrapper';
import HistoryList from './HistoryList';
import FormBuilder from './FormBuilder';
import BentoCard from '../BentoCard';
import { commonClasses } from '../../styles/theme';
import { RefreshCw, Languages, Volume2, FileImage, FileText, Image, Mic } from 'lucide-react';

// Icon mapping
const ICON_MAP: Record<string, any> = {
  'Languages': Languages,
  'Volume2': Volume2,
  'FileImage': FileImage,
  'FileText': FileText,
  'Image': Image,
  'Mic': Mic
};

interface UniversalToolProps {
  config: ToolDefinition;
  customRender?: (props: {
    execute: (input: any) => Promise<any>;
    loading: boolean;
    error: string | null;
    result: any;
  }) => React.ReactNode;
}

/**
 * UniversalTool - Dynamic tool renderer based on configuration
 *
 * This component can render any tool dynamically using its configuration
 * with automatic form generation, history management, and execution handling.
 *
 * Usage:
 *   <UniversalTool config={AI_TOOLS.translation} />
 */
const UniversalTool: React.FC<UniversalToolProps> = ({ config, customRender }) => {
  const {
    execute,
    loading,
    error,
    result,
    history,
    isFavorite,
    toggleFavorite,
    clearError,
    validate
  } = useToolModel(config);

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [output, setOutput] = useState<any>(null);

  // Get icon component
  const IconComponent = typeof config.icon === 'string'
    ? ICON_MAP[config.icon] || FileText
    : config.icon;

  const handleSubmit = async () => {
    clearError();
    setValidationErrors({});

    // Validate input
    const validation = validate(formValues);
    if (!validation.valid) {
      const errors: Record<string, string> = {};
      validation.errors.forEach(err => {
        const fieldMatch = err.match(/Field '(\w+)'/);
        if (fieldMatch) {
          errors[fieldMatch[1]] = err;
        }
      });
      setValidationErrors(errors);
      return;
    }

    try {
      const result = await execute(formValues);
      setOutput(result);
    } catch (err) {
      console.error('Tool execution failed:', err);
    }
  };

  const handleClear = () => {
    setFormValues({});
    setOutput(null);
    clearError();
    setValidationErrors({});
  };

  // Get gradient class
  const getGradientClass = (gradient: string): string => {
    const gradients: Record<string, string> = {
      'blue-purple': 'from-blue-500 to-purple-600',
      'green-teal': 'from-green-500 to-teal-600',
      'orange-red': 'from-orange-500 to-red-600',
      'purple-pink': 'from-purple-500 to-pink-600',
      'indigo-blue': 'from-indigo-500 to-blue-600'
    };
    return gradients[gradient] || gradient;
  };

  return (
    <ToolWrapper
      title={config.name}
      icon={IconComponent}
      gradient={getGradientClass(config.gradient || 'blue-purple')}
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory(!showHistory)}
      history={
        config.history ? (
          <HistoryList
            items={history}
            showInput={true}
            showOutput={true}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Custom Render or Default Form */}
        {customRender ? (
          customRender({ execute, loading, error, result })
        ) : (
          <>
            {/* Input Form */}
            <BentoCard title="Input">
              <FormBuilder
                schema={config.inputSchema}
                values={formValues}
                onChange={setFormValues}
                errors={validationErrors}
                disabled={loading}
                layout="vertical"
              />
            </BentoCard>

            {/* Output Display */}
            {(output || loading) && (
              <BentoCard title="Output">
                <div className={`${commonClasses.input} min-h-[200px] whitespace-pre-wrap bg-slate-50 dark:bg-slate-800`}>
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Processing...
                        </p>
                      </div>
                    </div>
                  ) : output ? (
                    <div>
                      {typeof output === 'string' ? (
                        <p>{output}</p>
                      ) : (
                        <pre className="text-sm">{JSON.stringify(output, null, 2)}</pre>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-400 text-center">
                        Output will appear here
                      </p>
                    </div>
                  )}
                </div>
              </BentoCard>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Submit'
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
          >
            Clear
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </ToolWrapper>
  );
};

export default UniversalTool;


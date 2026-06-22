import React, { useState, ChangeEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

interface FormFieldSchema {
  type: 'string' | 'number' | 'file' | 'boolean' | 'select';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

interface FormSchema {
  required?: string[];
  properties: Record<string, FormFieldSchema>;
}

interface FormBuilderProps {
  schema: FormSchema;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  layout?: 'vertical' | 'grid';
}

/**
 * FormBuilder - Dynamic form generator based on schema
 */
const FormBuilder: React.FC<FormBuilderProps> = ({
  schema,
  values,
  onChange,
  errors = {},
  disabled = false,
  layout = 'vertical'
}) => {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...values,
      [fieldName]: value
    });
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched({
      ...touched,
      [fieldName]: true
    });
  };

  const isRequired = (fieldName: string): boolean => {
    return schema.required?.includes(fieldName) || false;
  };

  const getFieldError = (fieldName: string): string | undefined => {
    if (!touched[fieldName]) return undefined;
    return errors[fieldName];
  };

  const renderField = (fieldName: string, fieldSchema: FormFieldSchema) => {
    const value = values[fieldName] || '';
    const error = getFieldError(fieldName);
    const required = isRequired(fieldName);
    const label = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const inputClasses = `${commonClasses.input} ${
      error ? 'border-red-500 dark:border-red-500' : ''
    }`;

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.multiline) {
          return (
            <div key={fieldName}>
              <label className="block text-sm font-medium mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                value={value}
                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                onBlur={() => handleFieldBlur(fieldName)}
                placeholder={fieldSchema.placeholder || `Enter ${label.toLowerCase()}`}
                disabled={disabled}
                rows={fieldSchema.rows || 4}
                className={`${inputClasses} resize-none`}
                minLength={fieldSchema.minLength}
                maxLength={fieldSchema.maxLength}
              />
              {error && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium mb-2">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              onBlur={() => handleFieldBlur(fieldName)}
              placeholder={fieldSchema.placeholder || `Enter ${label.toLowerCase()}`}
              disabled={disabled}
              className={inputClasses}
              minLength={fieldSchema.minLength}
              maxLength={fieldSchema.maxLength}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium mb-2">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value))}
              onBlur={() => handleFieldBlur(fieldName)}
              placeholder={fieldSchema.placeholder || `Enter ${label.toLowerCase()}`}
              disabled={disabled}
              className={inputClasses}
              min={fieldSchema.min}
              max={fieldSchema.max}
              step="any"
            />
            {error && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'file':
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium mb-2">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleFieldChange(fieldName, file);
              }}
              onBlur={() => handleFieldBlur(fieldName)}
              disabled={disabled}
              className={inputClasses}
            />
            {error && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={fieldName} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
              onBlur={() => handleFieldBlur(fieldName)}
              disabled={disabled}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
            />
            <label className="text-sm font-medium">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {error && (
              <p className="text-red-500 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium mb-2">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              onBlur={() => handleFieldBlur(fieldName)}
              disabled={disabled}
              className={inputClasses}
            >
              <option value="">Select {label.toLowerCase()}</option>
              {fieldSchema.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const fields = Object.entries(schema.properties) as Array<[string, FormFieldSchema]>;

  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(([fieldName, fieldSchema]) =>
          renderField(fieldName, fieldSchema)
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map(([fieldName, fieldSchema]) =>
        renderField(fieldName, fieldSchema)
      )}
    </div>
  );
};

export default FormBuilder;

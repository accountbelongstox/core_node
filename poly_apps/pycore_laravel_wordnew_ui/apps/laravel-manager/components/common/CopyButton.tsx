import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useClipboard } from '@/apps/laravel-manager/hooks/useClipboard';

export interface CopyButtonProps {
  /**
   * Text content to copy to clipboard
   * Can be a string, array of strings, or a function that returns a string/array
   */
  text: string | string[] | (() => string | string[]);
  
  /**
   * Custom success message (default: "Copied to clipboard")
   */
  successMessage?: string;
  
  /**
   * Button label text
   */
  label?: string;
  
  /**
   * Show icon in button
   */
  showIcon?: boolean;
  
  /**
   * Button size variant
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Button style variant
   */
  variant?: 'default' | 'outline' | 'ghost';
  
  /**
   * Custom className for button
   */
  className?: string;
  
  /**
   * Icon size
   */
  iconSize?: number;
  
  /**
   * Show check icon after successful copy
   */
  showCheckIcon?: boolean;
  
  /**
   * Duration to show check icon (ms)
   */
  checkIconDuration?: number;
}

/**
 * CopyButton - A reusable button component for copying text to clipboard
 * 
 * Features:
 * - Supports single string or array of strings (joins with newline)
 * - Toast notifications on success/failure
 * - Visual feedback with check icon
 * - Multiple size and style variants
 * - Accessible and keyboard-friendly
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <CopyButton text="Hello World" />
 * 
 * // With label
 * <CopyButton text="Hello World" label="Copy All Text" />
 * 
 * // Copy multiple items
 * <CopyButton text={["Item 1", "Item 2", "Item 3"]} label="Copy All" />
 * 
 * // Custom styling
 * <CopyButton 
 *   text="Content" 
 *   variant="outline" 
 *   size="sm"
 *   className="custom-class"
 * />
 * ```
 */
export function CopyButton({
  text,
  successMessage,
  label,
  showIcon = true,
  size = 'md',
  variant = 'default',
  className = '',
  iconSize = 16,
  showCheckIcon = true,
  checkIconDuration = 2000
}: CopyButtonProps) {
  const { copy, copyMultiple } = useClipboard();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Resolve text value (support function form)
    const textValue = typeof text === 'function' ? text() : text;
    const isArray = Array.isArray(textValue);
    const success = isArray 
      ? await copyMultiple(textValue as string[], successMessage)
      : await copy(textValue as string, successMessage || 'Copied to clipboard');

    if (success && showCheckIcon) {
      setCopied(true);
      setTimeout(() => setCopied(false), checkIconDuration);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  // Variant classes
  const variantClasses = {
    default: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    outline: 'bg-transparent border border-slate-600 hover:bg-slate-700/50 text-slate-300',
    ghost: 'bg-transparent hover:bg-slate-700/30 text-slate-400 hover:text-slate-200'
  };

  const baseClasses = `${sizeClasses[size]} ${variantClasses[variant]} rounded font-medium flex items-center gap-1.5 transition-colors ${className}`;

  return (
    <button
      onClick={handleCopy}
      className={baseClasses}
      title={label || 'Copy to clipboard'}
      type="button"
    >
      {showIcon && (
        copied && showCheckIcon ? (
          <Check size={iconSize} className="text-green-400" />
        ) : (
          <Copy size={iconSize} />
        )
      )}
      {label && <span>{label}</span>}
    </button>
  );
}

/**
 * CopyAllButton - Convenience component for copying all items from an array
 * 
 * @example
 * ```tsx
 * <CopyAllButton items={["Item 1", "Item 2"]} label="Copy All" />
 * ```
 */
export function CopyAllButton({
  items,
  label = 'Copy All',
  ...props
}: Omit<CopyButtonProps, 'text'> & { items: string[] }) {
  return <CopyButton text={items} label={label} {...props} />;
}


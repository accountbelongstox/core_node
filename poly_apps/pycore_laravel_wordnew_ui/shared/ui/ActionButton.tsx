import React from 'react';
import { Loader2 } from 'lucide-react';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent' | 'ghostDanger';

interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ActionButtonVariant;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Stretch to the full row width. */
  block?: boolean;
  children?: React.ReactNode;
}

const VARIANT: Record<ActionButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:opacity-90',
  secondary: 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md hover:opacity-90',
  accent: 'bg-cyan-600 text-white shadow-md hover:bg-cyan-500',
  ghostDanger: 'border border-zinc-700/50 bg-zinc-800 text-red-400 hover:bg-red-950/40 hover:text-red-300',
};

const SIZE: Record<NonNullable<ActionButtonProps['size']>, string> = { sm: 'px-4 py-2 rounded-xl', md: 'px-5 py-2 rounded-xl', lg: 'px-5 py-3 rounded-2xl' };

/** The one dialog / form action button (primary, secondary, danger, accent). */
export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary', size = 'md', icon, trailingIcon, loading = false, block = false, className = '', type = 'button', disabled, children, ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 font-mono text-xs font-black uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50 ${SIZE[size]} ${VARIANT[variant]} ${block ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    {children && <span>{children}</span>}
    {trailingIcon}
  </button>
);

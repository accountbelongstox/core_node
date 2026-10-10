import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface MobileButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  to?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children, variant = 'secondary', block = false, small = false, loading = false, disabled = false, icon, to, type = 'button', onClick,
}) => {
  const className = `cmm-btn is-${variant} ${block ? 'is-block' : ''} ${small ? 'is-small' : ''}`.trim();
  const content = <>{loading ? <Loader2 className="cmm-spin" aria-hidden="true" /> : icon}<span>{children}</span></>;
  if (to && !disabled) return <Link to={to} className={className}>{content}</Link>;
  return <button type={type} className={className} disabled={disabled || loading} onClick={onClick}>{content}</button>;
};

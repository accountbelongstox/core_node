import React from 'react';

interface MobileFieldProps {
  label: string;
  hint?: string;
  error?: string | false | null;
  children: React.ReactNode;
}

/** Label, control and hint or error line; style the control with `className="cmm-input"`. */
export const MobileField: React.FC<MobileFieldProps> = ({ label, hint, error, children }) => (
  <label className="cmm-field">
    <span className="cmm-field__label">{label}</span>
    {children}
    {error ? <small className="cmm-field__error" role="alert">{error}</small> : hint ? <small className="cmm-field__hint">{hint}</small> : null}
  </label>
);

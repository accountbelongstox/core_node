import React from 'react';

/** Hosts a web page inside the mobile frame until the page has its own mobile screen. */
export const MobileWebFallback: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="cmm-web-fallback">{children}</div>
);

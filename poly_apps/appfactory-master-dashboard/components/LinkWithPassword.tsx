import React from 'react';
import { Link as ReactRouterLink, LinkProps } from 'react-router-dom';
import { HARDCODED_PASSWORD, PASSWORD_PARAM_NAME } from '../services/passwordService';

/**
 * Link component that automatically adds password parameter
 * Wraps React Router's Link component to include password parameter
 * 
 * React best practice: Compose React Router components instead of replacing them
 * 
 * Usage:
 *   <LinkWithPassword to="/dashboard">Dashboard</LinkWithPassword>
 *   // Automatically becomes /dashboard?pp=BuildFactoryEncryptionKey2025
 */
export const LinkWithPassword: React.FC<LinkProps> = ({ to, ...props }) => {
  // Parse the path and existing parameters
  const toString = typeof to === 'string' ? to : to.pathname || '';
  const [path, existingParams] = toString.split('?');
  const params = new URLSearchParams(existingParams || '');
  
  // Add password parameter
  params.set(PASSWORD_PARAM_NAME, HARDCODED_PASSWORD);
  
  // Build new path with password parameter
  const newTo = `${path}?${params.toString()}`;
  
  // Use React Router's Link component with password parameter
  return <ReactRouterLink to={newTo} {...props} />;
};


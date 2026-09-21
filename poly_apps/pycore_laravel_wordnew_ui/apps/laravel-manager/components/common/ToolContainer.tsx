import React from 'react';

interface ToolContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl'
};

export function ToolContainer({ title, description, children, maxWidth = '4xl' }: ToolContainerProps) {
  return (
    <div className={`${maxWidthClasses[maxWidth]} mx-auto p-6`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

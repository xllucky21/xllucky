import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  extra?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, extra }) => {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-5 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300 ${className}`}>
      {(title || extra) && (
        <div className="flex justify-between items-center mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-100">{title}</h3>}
          {extra}
        </div>
      )}
      {children}
    </div>
  );
};
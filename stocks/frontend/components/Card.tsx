import React, { forwardRef } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className = '' }, ref) => {
  return (
    <div 
      ref={ref}
      className={`bg-gray-900/70 border border-gray-800 rounded-xl p-4 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

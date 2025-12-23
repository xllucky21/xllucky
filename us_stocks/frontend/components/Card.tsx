import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ children, className = '' }, ref) => (
  <div ref={ref} className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-4 ${className}`}>
    {children}
  </div>
));

Card.displayName = 'Card';

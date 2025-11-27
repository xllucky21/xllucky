
import React from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  term: string;
  content: string;
  showIcon?: boolean;
  position?: 'top' | 'bottom';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  term, 
  content, 
  showIcon = true,
  position = 'top' 
}) => {
  const isTop = position === 'top';

  return (
    <div className="group relative inline-flex items-center cursor-help z-10">
      {term && (
        <span className="border-b border-dashed border-slate-600 group-hover:border-indigo-400 transition-colors">
          {term}
        </span>
      )}
      {showIcon && (
        <HelpCircle className="w-3 h-3 ml-1.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
      )}
      
      {/* Tooltip Popover */}
      <div 
        className={`absolute left-1/2 transform -translate-x-1/2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] 
        ${isTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      >
        {/* Content with max-height and scrollbar */}
        <div className="text-xs text-slate-200 font-normal leading-relaxed text-left whitespace-pre-line max-h-64 overflow-y-auto custom-scrollbar">
          {content}
        </div>
        
        {/* Arrow */}
        <div 
          className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent 
          ${isTop 
            ? 'top-full -mt-0 border-t-slate-700' 
            : 'bottom-full -mb-0 border-b-slate-700'
          }`}
        ></div>
      </div>
    </div>
  );
};

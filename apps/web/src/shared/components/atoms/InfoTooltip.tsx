import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@shared/lib/utils';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center ml-1.5" ref={ref}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
        aria-label="Plus d'informations"
      >
        <HelpCircle size={14} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-56 p-3 mt-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-xl shadow-xl left-1/2 -translate-x-1/2 top-full">
          {text}
          <div className="absolute w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45 -top-1.5 left-1/2 -translate-x-1/2"></div>
        </div>
      )}
    </div>
  );
}

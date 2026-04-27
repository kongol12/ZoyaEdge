import React from 'react';
import { cn } from '@shared/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 text-sm font-medium outline-none transition-all duration-300 focus:ring-2 focus:ring-zoya-red focus:border-transparent',
            icon && 'pl-12',
            error && 'border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';

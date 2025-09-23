import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ className, label, id, ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-brand-primary/80 mb-1">{label}</label>}
      <input
        id={id}
        className={cn(
          'w-full bg-dark-surface border-2 border-brand-primary/30 rounded-md px-3 py-2 text-dark-text placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-300',
          className
        )}
        {...props}
      />
    </div>
  );
};

export default Input;
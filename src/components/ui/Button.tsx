import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold tracking-wider rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    primary:
      'bg-brand-primary text-black hover:bg-opacity-80 hover:shadow-glow-primary focus:ring-brand-primary',
    secondary:
      'bg-transparent border-2 border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-black hover:shadow-glow-secondary focus:ring-brand-secondary',
    ghost:
      'bg-transparent text-brand-primary hover:bg-brand-primary/10',
    destructive:
      'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
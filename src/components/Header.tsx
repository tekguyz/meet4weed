
import React from 'react';
import { ArrowLeftIcon } from './icons';

interface HeaderProps {
  title: string;
  onBack?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onBack }) => {
  return (
    <header className="sticky top-0 z-30 w-full h-16 bg-dark-bg/80 backdrop-blur-sm border-b-2 border-brand-primary/20 flex items-center">
      <div className="container mx-auto flex items-center justify-center relative px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-4 text-brand-primary hover:text-brand-primary/80 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-xl font-bold text-brand-primary tracking-wider truncate">
          {title}
        </h1>
      </div>
    </header>
  );
};

export default Header;

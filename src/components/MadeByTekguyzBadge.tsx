
import React from 'react';

// This is your new, official logomark component
const LogomarkIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 32 32" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      aria-hidden="true"
    >
      <title>TEKGUYZ Logomark</title>
      <circle cx="16" cy="16" r="15" fill="none" strokeWidth="2" stroke="currentColor" />
      <path d="M 13 10 L 9 13 L 13 16" strokeWidth="2.5" fill="none" stroke="currentColor" />
      <path d="M 19 10 L 23 13 L 19 16" strokeWidth="2.5" fill="none" stroke="currentColor" />
      <path d="M 10 21 Q 16 26 22 21" strokeWidth="2.5" fill="none" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
};


interface MadeByTekguyzProps {
  // Allow passing custom theme classes for different apps
  theme?: 'dark' | 'light';
}

export const MadeByTekguyz: React.FC<MadeByTekguyzProps> = ({ theme = 'dark' }) => {
  const themeClasses = {
    dark: 'bg-black text-gray-400 hover:text-white',
    light: 'bg-white text-gray-500 hover:text-black'
  };

  return (
    <a
      href="https://tekguyz.com?ref=made-by-tekguyz"
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-4 right-4 flex items-center px-3 py-1.5 rounded-lg shadow-lg transition-colors duration-300 text-xs font-semibold z-50 ${themeClasses[theme]}`}
    >
      <LogomarkIcon className="w-4 h-4 mr-1.5" />
      <span>Made by <strong>TEKGUYZ</strong></span>
    </a>
  );
};

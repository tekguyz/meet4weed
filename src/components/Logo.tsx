
import React from 'react';

interface LogoProps {
    onClick?: () => void;
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ onClick, className }) => {
    return (
        <div 
            className={`flex items-center space-x-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            <svg className="w-6 h-6 text-brand-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            <span className="text-xl font-bold text-brand-primary tracking-wider">meet4weed</span>
        </div>
    );
};

export default Logo;

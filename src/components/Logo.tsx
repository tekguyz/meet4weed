
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
            <svg className="w-8 h-8 text-brand-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22V10M12 10C12 10 16 6.5 18 3.5C18 3.5 15 7.5 12 10ZM12 10C12 10 8 6.5 6 3.5C6 3.5 9 7.5 12 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 14.5C17 14.5 14 11 12 10C12 10 15.5 12.5 17 14.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 14.5C7 14.5 10 11 12 10C12 10 8.5 12.5 7 14.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 19.5C15 19.5 13 15 12 10C12 10 14 16.5 15 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 19.5C9 19.5 11 15 12 10C12 10 10 16.5 9 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-2xl font-bold text-brand-primary tracking-wider">Meet4Weed</span>
        </div>
    );
};

export default Logo;
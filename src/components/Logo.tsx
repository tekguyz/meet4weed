
import React from 'react';
import Logomark from './Logomark';
import { cn } from '../lib/utils';

interface LogoProps {
    onClick?: () => void;
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ onClick, className }) => {
    return (
        <div 
            className={cn(
                'flex items-center space-x-2', 
                onClick && 'cursor-pointer',
                className
            )}
            onClick={onClick}
        >
            <Logomark className="w-8 h-8 text-brand-primary" />
            <span className="text-2xl font-bold text-brand-primary tracking-wider">Meet4Weed</span>
        </div>
    );
};

export default Logo;

import React, { useContext } from 'react';
import Button from '../components/ui/Button';
import { AppContext } from '../context/AppContext';
import { Page } from '../types';

const NotFound: React.FC = () => {
    const { onNavigate } = useContext(AppContext);

    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-8xl font-bold text-brand-primary tracking-wider">404</h1>
            <h2 className="mt-2 text-2xl text-brand-secondary">Vibe Not Found</h2>
            <p className="mt-4 max-w-md text-dark-text/80">
                Looks like you've wandered off the beaten path. The page you're looking for doesn't exist or has been moved.
            </p>
            <Button onClick={() => onNavigate(Page.Home)} className="mt-8">
                Return to Sessions
            </Button>
        </div>
    );
};

export default NotFound;
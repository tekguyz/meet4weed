
import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Page } from '../types';
import { HomeIcon, MessageSquareIcon, UserCircleIcon } from './icons';
import { cn } from '../lib/utils';

const BottomNavBar: React.FC = () => {
  const { currentPage, onNavigate, currentUser } = useContext(AppContext);

  const navItems = [
    { page: Page.Home, icon: HomeIcon, label: 'Sessions' },
    { page: Page.Messaging, icon: MessageSquareIcon, label: 'Chats' },
    { page: Page.Profile, icon: UserCircleIcon, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-dark-surface border-t-2 border-brand-primary/20">
      <div className="container mx-auto flex justify-around h-16">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              className={cn(
                'flex flex-col items-center justify-center w-full pt-1 text-xs transition-colors duration-200',
                isActive ? 'text-brand-primary' : 'text-dark-text/60 hover:text-dark-text'
              )}
            >
              {item.page === Page.Profile && currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="Profile" className={cn('w-7 h-7 rounded-full border-2', isActive ? 'border-brand-primary' : 'border-dark-text/60')} />
              ) : (
                <item.icon className="w-7 h-7" />
              )}
              <span className="mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;

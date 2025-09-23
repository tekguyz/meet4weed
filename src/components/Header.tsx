
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ArrowLeftIcon, BellIcon } from './icons';
import { Notification } from '../types';
import NotificationsPanel from './NotificationsPanel';

interface HeaderProps {
  title: string;
  onBack?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onBack }) => {
  const { 
    currentUser, 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    setSelectedEvent 
  } = useContext(AppContext);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const userNotifications = notifications.filter(n => n.userId === currentUser?.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
  const unreadCount = userNotifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (!isPanelOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
            setPanelOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen]);

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);
    setSelectedEvent(notification.relatedId);
    setPanelOpen(false);
  }

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead();
  }

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-dark-bg/80 backdrop-blur-sm border-b-2 border-brand-primary/20 flex items-center">
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
        <div className="absolute right-4" ref={panelRef}>
            <button 
                onClick={() => setPanelOpen(prev => !prev)}
                className="relative text-brand-primary hover:text-brand-primary/80 transition-colors"
                aria-label="Toggle notifications"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-secondary text-black text-xs items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                </span>
                )}
            </button>
            {isPanelOpen && (
                <NotificationsPanel 
                notifications={userNotifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllAsRead={handleMarkAllAsRead}
                />
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;


import React from 'react';
import { Notification, NotificationType } from '../types';
import { ClockIcon, UserPlusIcon } from './icons';
import { cn } from '../lib/utils';
import Button from './ui/Button';

interface NotificationsPanelProps {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllAsRead: () => void;
}

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
    const iconProps = { className: "w-6 h-6" };
    switch (type) {
        case NotificationType.NewRsvp:
            return <UserPlusIcon {...iconProps} />;
        case NotificationType.EventReminder:
            return <ClockIcon {...iconProps} />;
        default:
            return null;
    }
}

const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    if (seconds < 5) return "just now";
    return Math.floor(seconds) + "s ago";
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ notifications, onNotificationClick, onMarkAllAsRead }) => {
    return (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-dark-surface border-2 border-brand-primary/30 rounded-lg shadow-lg z-50 animate-fade-in-down">
            <div className="flex justify-between items-center p-3 border-b border-brand-primary/20">
                <h3 className="font-bold text-brand-primary text-lg">Notifications</h3>
                {notifications.some(n => !n.isRead) && (
                    <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>Mark all as read</Button>
                )}
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    <ul>
                        {notifications.map(notification => (
                            <li key={notification.id} onClick={() => onNotificationClick(notification)} className="border-b border-brand-primary/10 last:border-b-0">
                                <div className={cn(
                                    "flex items-start gap-4 p-4 hover:bg-brand-primary/5 cursor-pointer",
                                    !notification.isRead && "bg-brand-primary/10"
                                )}>
                                    <div className="text-brand-secondary mt-1">
                                        <NotificationIcon type={notification.type} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-dark-text">{notification.message}</p>
                                        <p className="text-xs text-dark-text/60 mt-1">{timeAgo(notification.timestamp)}</p>
                                    </div>
                                    {!notification.isRead && (
                                        <div className="w-2.5 h-2.5 bg-brand-secondary rounded-full self-center flex-shrink-0"></div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center text-dark-text/70">
                        You're all caught up!
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default NotificationsPanel;


import React from 'react';
import { Event, User } from '../types';

interface EventCardProps {
  event: Event;
  host?: User;
  onSelectEvent: (eventId: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, host, onSelectEvent }) => {
  return (
    <div 
      className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-4 cursor-pointer transition-all duration-300 hover:border-brand-primary hover:shadow-glow-primary flex flex-col h-full"
      onClick={() => onSelectEvent(event.id)}
    >
      <div>
        <h3 className="text-lg font-bold text-brand-primary truncate">{event.title}</h3>
        <p className="text-sm text-brand-secondary mb-2">{event.eventType}</p>
        <p className="text-xs text-dark-text/70 mb-3 overflow-hidden">{event.description}</p>
      </div>
      
      <div className="flex items-center justify-between text-xs border-t border-brand-primary/10 pt-3 mt-auto">
        <div className="flex items-center">
          {host && <img src={host.avatarUrl} alt={host.name} className="w-6 h-6 rounded-full mr-2 border border-brand-secondary" />}
          <span className="font-semibold">{host ? `Hosted by ${host.name}` : '...'}</span>
        </div>
        <div className="text-right">
          <p>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          <p>{event.time}</p>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
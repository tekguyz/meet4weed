
import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import EventCard from '../components/EventCard';
import { SearchIcon, PlusCircleIcon } from '../components/icons';
import { EventType } from '../types';
import SkeletonCard from '../components/ui/SkeletonCard';
import { cn } from '../lib/utils';
import Input from '../components/ui/Input';
import EventEditorModal from '../components/EventEditorModal';

const Home: React.FC = () => {
  const { events, users, setSelectedEvent, isLoading } = useContext(AppContext);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventType | 'All'>('All');

  const handleSelectEvent = (eventId: string) => {
    setSelectedEvent(eventId);
  };
  
  const filteredEvents = events.filter(event => {
    const matchesFilter = activeFilter === 'All' || event.eventType === activeFilter;
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filterOptions: (EventType | 'All')[] = ['All', ...Object.values(EventType)];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 space-y-4">
        <div className="relative w-full">
          <Input 
              type="text" 
              placeholder="Search sessions..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary/50" />
        </div>
        
        <div className="flex space-x-2 overflow-x-auto pb-2 -mx-4 px-4">
            {filterOptions.map(filter => (
                <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                        'px-4 py-1.5 text-sm font-semibold rounded-full border-2 whitespace-nowrap transition-colors duration-200',
                        activeFilter === filter
                        ? 'bg-brand-primary text-black border-brand-primary'
                        : 'bg-dark-surface border-brand-primary/30 text-dark-text/80 hover:bg-brand-primary/10 hover:border-brand-primary/60'
                    )}
                >
                    {filter}
                </button>
            ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                host={users.find(u => u.id === event.hostId)}
                onSelectEvent={handleSelectEvent}
              />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-brand-secondary">No Sessions Found</h2>
          <p className="text-dark-text/70 mt-2">No sessions match your filter. Why not start your own?</p>
        </div>
      )}
      
      <button 
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-20 right-4 bg-brand-primary text-black rounded-full p-4 shadow-lg shadow-brand-primary/30 hover:bg-opacity-80 transition-all duration-300 z-30"
        aria-label="Start a Sesh"
      >
        <PlusCircleIcon className="w-8 h-8"/>
      </button>

      <EventEditorModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Home;
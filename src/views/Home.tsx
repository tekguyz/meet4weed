
import React, { useState, useContext } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import EventCard from '../components/EventCard';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { SearchIcon, PlusCircleIcon, Trash2Icon } from '../components/icons';
import { EventType, User, StrainPreference, StrainContribution } from '../types';
import SkeletonCard from '../components/ui/SkeletonCard';
import { cn } from '../lib/utils';
import StrainPill from '../components/ui/StrainPill';

const Home: React.FC = () => {
  const { events, users, setSelectedEvent, currentUser, isLoading } = useContext(AppContext);
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

      {currentUser && <CreateEventWizard isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} currentUser={currentUser} />}
    </div>
  );
};

const CreateEventWizard: React.FC<{isOpen: boolean, onClose: () => void, currentUser: User}> = ({ isOpen, onClose, currentUser }) => {
    const { onCreateEvent, showToast } = useContext(AppContext);
    const [strains, setStrains] = useState<Omit<StrainContribution, 'userId'>[]>([]);
    const [newStrainName, setNewStrainName] = useState('');
    const [newStrainType, setNewStrainType] = useState<StrainPreference>(StrainPreference.Hybrid);

    const [formData, setFormData] = useState({
        title: '',
        eventType: EventType.Chill,
        date: '',
        time: '',
        location: '',
        description: '',
        tags: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleAddStrain = () => {
        if (!newStrainName.trim()) {
            showToast("Please enter a strain name.", ToastType.Warning);
            return;
        }
        setStrains(prev => [...prev, { id: `temp-${Date.now()}`, strainName: newStrainName, type: newStrainType }]);
        setNewStrainName('');
        setNewStrainType(StrainPreference.Hybrid);
    };

    const handleRemoveStrain = (id: string) => {
        setStrains(prev => prev.filter(s => s.id !== id));
    };
    
    const handleSubmit = () => {
        if (!formData.title.trim() || !formData.date || !formData.time || !formData.location.trim() || !formData.description.trim()) {
            showToast("Please fill out all required fields.", ToastType.Error);
            return;
        }

        const newEvent = {
            id: `e${Date.now()}`,
            ...formData,
            hostId: currentUser.id,
            attendees: [currentUser.id], // Host automatically attends
            strainsOnDeck: strains.map(s => ({...s, id: `s${Date.now()}${Math.random()}`, userId: currentUser.id})),
            tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        };
        onCreateEvent(newEvent);
        handleClose();
    }
    
    const handleClose = () => {
        setFormData({
            title: '', eventType: EventType.Chill, date: '', time: '',
            location: '', description: '', tags: '',
        });
        setStrains([]);
        setNewStrainName('');
        setNewStrainType(StrainPreference.Hybrid);
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Create a New Session">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <Input name="title" label="Session Title" placeholder="e.g., Sunset Vibes & Vinyls" value={formData.title} onChange={handleInputChange} required />
                <div>
                    <label htmlFor="eventType" className="block text-sm font-medium text-brand-primary/80 mb-1">Event Type</label>
                    <select name="eventType" id="eventType" value={formData.eventType} onChange={handleInputChange} className="w-full bg-dark-surface border-2 border-brand-primary/30 rounded-md px-3 py-2 text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary">
                        {Object.values(EventType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input name="date" type="date" label="Date" value={formData.date} onChange={handleInputChange} required />
                    <Input name="time" type="time" label="Time" value={formData.time} onChange={handleInputChange} required />
                </div>
                <Input name="location" label="Location" placeholder="Private Residence, City" value={formData.location} onChange={handleInputChange} required />
                <Input name="tags" label="Desired Vibe / Tags" placeholder="e.g., chill, creative, deep talks" value={formData.tags} onChange={handleInputChange} />
                
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-brand-primary/80 mb-1">Description</label>
                    <textarea name="description" id="description" rows={3} value={formData.description} onChange={handleInputChange} className="w-full bg-dark-surface border-2 border-brand-primary/30 rounded-md px-3 py-2 text-dark-text placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-300" placeholder="Describe the session..." required></textarea>
                </div>
                
                {/* Strain Contribution Section */}
                <div className="border-t-2 border-brand-primary/20 pt-4 space-y-3">
                    <label className="block text-sm font-medium text-brand-primary/80">Strains You're Bringing (Optional)</label>
                    <div className="flex items-end gap-2">
                        <Input 
                            name="strainName" 
                            label="Strain Name" 
                            value={newStrainName}
                            onChange={(e) => setNewStrainName(e.target.value)}
                            placeholder="e.g., Blue Dream"
                        />
                         <div className="flex-shrink-0">
                             <label htmlFor="strainType" className="block text-sm font-medium text-brand-primary/80 mb-1">Type</label>
                            <select 
                                name="strainType" 
                                id="strainType" 
                                value={newStrainType} 
                                onChange={(e) => setNewStrainType(e.target.value as StrainPreference)} 
                                className="h-11 bg-dark-surface border-2 border-brand-primary/30 rounded-md px-3 py-2 text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            >
                                {Object.values(StrainPreference).filter(v => v !== StrainPreference.Any).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <Button variant="secondary" onClick={handleAddStrain} className="h-11">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {strains.map(s => (
                            <StrainPill key={s.id} strain={{...s, userId: currentUser.id}} onRemove={() => handleRemoveStrain(s.id)} />
                        ))}
                    </div>
                </div>
                
                <Button onClick={handleSubmit} className="w-full mt-4">Publish Session</Button>
            </div>
        </Modal>
    )
}

export default Home;
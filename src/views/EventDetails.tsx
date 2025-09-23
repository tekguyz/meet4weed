
import React, { useContext } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import { User, StrainContribution } from '../types';
import Button from '../components/ui/Button';
import StrainPill from '../components/ui/StrainPill';
import { CopyIcon, MapPinIcon } from '../components/icons';

const EventDetails: React.FC = () => {
    const { selectedEvent, users, currentUser, onRsvp, onUnRsvp, setSelectedUser, showToast } = useContext(AppContext);

    if (!selectedEvent) {
        return <div className="text-center p-8">Event not found.</div>;
    }

    const host = users.find(u => u.id === selectedEvent.hostId);
    const attendees = users.filter(u => selectedEvent.attendees.includes(u.id));
    const isAttending = currentUser ? selectedEvent.attendees.includes(currentUser.id) : false;

    const handleRsvp = () => {
        if (currentUser) {
            onRsvp(selectedEvent.id, currentUser.id);
        }
    };
    
    const handleUnRsvp = () => {
        if(currentUser) {
            onUnRsvp(selectedEvent.id, currentUser.id);
        }
    }

    const handleCopyLocation = () => {
        navigator.clipboard.writeText(selectedEvent.location)
          .then(() => {
            showToast('Location copied to clipboard!', ToastType.Success);
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy location.', ToastType.Error);
          });
      };
  
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-8">
                <div className="border-b-2 border-brand-primary/20 pb-6 mb-6">
                    <p className="text-brand-secondary font-semibold">{selectedEvent.eventType}</p>
                    <h1 className="text-4xl font-bold text-brand-primary tracking-wider mt-1">{selectedEvent.title}</h1>
                    <div className="flex flex-wrap items-center mt-4 text-dark-text/80 gap-x-4 gap-y-2">
                        <span>{new Date(selectedEvent.date).toDateString()} at {selectedEvent.time}</span>
                        <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-brand-secondary" />
                            <a 
                              href={mapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="hover:text-brand-secondary transition-colors"
                              title="Open in maps"
                            >
                              {selectedEvent.location}
                            </a>
                            <button 
                              onClick={handleCopyLocation} 
                              className="text-dark-text/60 hover:text-brand-primary transition-colors"
                              title="Copy location"
                            >
                              <CopyIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-grow">
                        <p className="mb-8">{selectedEvent.description}</p>
                        
                        <Section title="Host">
                            {host && <UserPill user={host} onClick={() => setSelectedUser(host.id)} />}
                        </Section>

                        <Section title="Strains on Deck">
                            <div className="flex flex-wrap gap-4 items-start">
                                {selectedEvent.strainsOnDeck.length > 0 ? selectedEvent.strainsOnDeck.map((s: StrainContribution, i: number) => {
                                    const user = users.find(u => u.id === s.userId);
                                    return (
                                        <div key={i} className="flex flex-col items-center">
                                            <StrainPill strain={s} />
                                            <span className="text-xs text-dark-text/60 mt-1.5">from {user?.name}</span>
                                        </div>
                                    );
                                }) : <p className="text-sm text-dark-text/60">None yet. Be the first to share!</p>}
                            </div>
                        </Section>
                    </div>

                    <div className="w-full md:w-1/3 md:border-l-2 md:border-brand-primary/10 md:pl-8">
                        <Section title={`Crew (${attendees.length})`}>
                            <div className="flex flex-wrap gap-2">
                                {attendees.length > 0 ? attendees.map(a => <img 
                                    key={a.id} 
                                    src={a.avatarUrl} 
                                    title={a.name} 
                                    alt={a.name} 
                                    className="w-12 h-12 rounded-full border-2 border-brand-secondary cursor-pointer hover:border-brand-primary transition-colors"
                                    onClick={() => setSelectedUser(a.id)}
                                />) : <p className="text-sm text-dark-text/60">No one has RSVP'd yet.</p>}
                            </div>
                        </Section>
                        <div className="mt-6 flex flex-col gap-2">
                            {currentUser && (isAttending ? 
                                <Button onClick={handleUnRsvp} variant="destructive">Can't Make It</Button> 
                                : <Button onClick={handleRsvp}>RSVP</Button>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-xl font-bold text-brand-secondary mb-3">{title}</h2>
        {children}
    </div>
);

const UserPill: React.FC<{ user: User, onClick: () => void }> = ({ user, onClick }) => (
    <div onClick={onClick} className="inline-flex items-center gap-3 bg-dark-bg/50 p-2 rounded-full cursor-pointer hover:bg-dark-bg transition-colors">
        <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full border-2 border-brand-primary" />
        <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-dark-text/70">{user.location}</p>
        </div>
    </div>
);

export default EventDetails;

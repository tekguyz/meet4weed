
import React, { useContext, useState } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import { User, StrainContribution, StrainPreference } from '../types';
import Button from '../components/ui/Button';
import StrainPill from '../components/ui/StrainPill';
import { CopyIcon, MapPinIcon, UserPlusIcon, EditIcon, Trash2Icon } from '../components/icons';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import InviteModal from '../components/InviteModal';
import EventEditorModal from '../components/EventEditorModal';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const AddStrainModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddStrain: (strainName: string, strainType: StrainPreference) => void;
}> = ({ isOpen, onClose, onAddStrain }) => {
    const [strainName, setStrainName] = useState('');
    const [strainType, setStrainType] = useState<StrainPreference>(StrainPreference.Hybrid);

    const handleSubmit = () => {
        if (!strainName.trim()) {
            return;
        }
        onAddStrain(strainName, strainType);
        setStrainName('');
        setStrainType(StrainPreference.Hybrid);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Your Strain">
            <div className="space-y-4">
                <Input 
                    label="Strain Name" 
                    value={strainName} 
                    onChange={(e) => setStrainName(e.target.value)} 
                    placeholder="e.g., OG Kush"
                />
                <div>
                    <label htmlFor="strainTypeModal" className="block text-sm font-medium text-brand-primary/80 mb-1">Strain Type</label>
                    <select 
                        id="strainTypeModal"
                        value={strainType} 
                        onChange={(e) => setStrainType(e.target.value as StrainPreference)} 
                        className="w-full bg-dark-surface border-2 border-brand-primary/30 rounded-md px-3 py-2 text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    >
                        {Object.values(StrainPreference).filter(v => v !== StrainPreference.Any).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <Button onClick={handleSubmit} className="w-full">Contribute Strain</Button>
            </div>
        </Modal>
    );
}

const AskToContributeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onDecline: () => void;
}> = ({ isOpen, onClose, onConfirm, onDecline }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Your Vibe?">
            <div className="space-y-6 text-center">
                <p className="text-dark-text/80">
                    Are you planning to bring any strains to the session? Contributing helps everyone know what's on deck!
                </p>
                <div className="flex justify-center gap-4">
                    <Button onClick={onConfirm} variant="primary">Yes, I'll Share</Button>
                    <Button onClick={onDecline} variant="secondary">No, Just Vibing</Button>
                </div>
            </div>
        </Modal>
    );
}

const EventDetails: React.FC = () => {
    const { 
        selectedEvent, 
        users, 
        currentUser, 
        onRsvp, 
        onUnRsvp, 
        setSelectedUser, 
        showToast,
        addStrainContribution,
        removeStrainContribution,
        sendEventInvites,
        onDeleteEvent,
    } = useContext(AppContext);
    
    const [isAddStrainModalOpen, setAddStrainModalOpen] = useState(false);
    const [isAskToContributeModalOpen, setAskToContributeModalOpen] = useState(false);
    const [isInviteModalOpen, setInviteModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isConfirmCancelOpen, setConfirmCancelOpen] = useState(false);

    if (!selectedEvent) {
        return <div className="text-center p-8">Event not found.</div>;
    }

    const host = users.find(u => u.id === selectedEvent.hostId);
    const attendees = users.filter(u => selectedEvent.attendees.includes(u.id));
    const isAttending = currentUser ? selectedEvent.attendees.includes(currentUser.id) : false;
    const isHost = currentUser?.id === selectedEvent.hostId;

    const rsvpToEvent = () => {
        if (currentUser && selectedEvent) {
            onRsvp(selectedEvent.id, currentUser.id);
        }
    };
    
    const handleRsvpClick = () => {
        if (currentUser) {
            setAskToContributeModalOpen(true);
        }
    };
    
    const handleConfirmContribution = () => {
        rsvpToEvent();
        setAskToContributeModalOpen(false);
        setAddStrainModalOpen(true);
    };

    const handleDeclineContribution = () => {
        rsvpToEvent();
        setAskToContributeModalOpen(false);
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

    const handleAddStrain = (strainName: string, strainType: StrainPreference) => {
        addStrainContribution(selectedEvent.id, { strainName, type: strainType });
        showToast("Strain added!", ToastType.Success);
    };

    const handleRemoveStrain = (strainId: string) => {
        removeStrainContribution(selectedEvent.id, strainId);
        showToast("Strain removed.", ToastType.Warning);
    }
  
    const handleSendInvites = (userIds: string[]) => {
        sendEventInvites(selectedEvent.id, userIds);
    };

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <AskToContributeModal
                isOpen={isAskToContributeModalOpen}
                onClose={() => setAskToContributeModalOpen(false)}
                onConfirm={handleConfirmContribution}
                onDecline={handleDeclineContribution}
            />
            <AddStrainModal 
                isOpen={isAddStrainModalOpen}
                onClose={() => setAddStrainModalOpen(false)}
                onAddStrain={handleAddStrain}
            />
            <InviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onInvite={handleSendInvites}
                title="Invite to Session"
                existingParticipantIds={selectedEvent.attendees}
            />
            {isHost && (
                <EventEditorModal
                    isOpen={isEditModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    eventToEdit={selectedEvent}
                />
            )}
            <ConfirmationModal
                isOpen={isConfirmCancelOpen}
                onClose={() => setConfirmCancelOpen(false)}
                onConfirm={() => {
                    onDeleteEvent(selectedEvent.id);
                    setConfirmCancelOpen(false);
                }}
                title="Cancel Session"
                message="Are you sure you want to cancel this session? This action cannot be undone and all attendees will be notified."
            />

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
                            <div className="flex flex-col items-start gap-4">
                                <div className="flex flex-wrap gap-4 items-start">
                                    {selectedEvent.strainsOnDeck.length > 0 ? selectedEvent.strainsOnDeck.map((s: StrainContribution) => {
                                        const user = users.find(u => u.id === s.userId);
                                        return (
                                            <div key={s.id} className="flex flex-col items-center text-center">
                                                <StrainPill 
                                                    strain={s}
                                                    onRemove={currentUser?.id === s.userId ? () => handleRemoveStrain(s.id) : undefined}
                                                />
                                                <span className="text-xs text-dark-text/60 mt-1.5">
                                                    from {user?.name === currentUser?.name ? "You" : user?.name.split(" ")[0]}
                                                    {s.userId === host?.id && ' (Host)'}
                                                </span>
                                            </div>
                                        );
                                    }) : <p className="text-sm text-dark-text/60">None yet. Be the first to share!</p>}
                                </div>
                                {isAttending && (
                                    <Button variant="secondary" size="sm" onClick={() => setAddStrainModalOpen(true)}>
                                        Add My Strain
                                    </Button>
                                )}
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
                           {isHost ? (
                                <>
                                    <Button onClick={() => setEditModalOpen(true)} variant="secondary" className="flex items-center justify-center gap-2">
                                        <EditIcon className="w-5 h-5" />
                                        Edit Session
                                    </Button>
                                    <Button onClick={() => setConfirmCancelOpen(true)} variant="destructive" className="flex items-center justify-center gap-2">
                                        <Trash2Icon className="w-5 h-5" />
                                        Cancel Session
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {currentUser && (isAttending ? 
                                        <Button onClick={handleUnRsvp} variant="destructive">Can't Make It</Button> 
                                        : <Button onClick={handleRsvpClick}>RSVP</Button>)}
                                    <Button variant="secondary" onClick={() => setInviteModalOpen(true)} className="flex items-center justify-center gap-2">
                                        <UserPlusIcon className="w-5 h-5" />
                                        Invite
                                    </Button>
                                </>
                            )}
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
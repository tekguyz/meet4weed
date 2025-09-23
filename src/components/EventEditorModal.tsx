
import React, { useState, useContext, useEffect } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import { Event, User, EventType, StrainPreference, StrainContribution } from '../types';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import StrainPill from './ui/StrainPill';

interface EventEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: Event;
}

const EventEditorModal: React.FC<EventEditorModalProps> = ({ isOpen, onClose, eventToEdit }) => {
    const { currentUser, onCreateEvent, onUpdateEvent, showToast } = useContext(AppContext);
    
    const isEditMode = !!eventToEdit;

    const [strains, setStrains] = useState<Omit<StrainContribution, 'userId' | 'id'>[]>([]);
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

    useEffect(() => {
        if (isOpen && eventToEdit) {
            setFormData({
                title: eventToEdit.title,
                eventType: eventToEdit.eventType,
                date: eventToEdit.date,
                time: eventToEdit.time,
                location: eventToEdit.location,
                description: eventToEdit.description,
                tags: eventToEdit.tags.join(', '),
            });
            setStrains(eventToEdit.strainsOnDeck.map(({ strainName, type }) => ({ strainName, type })));
        }
    }, [isOpen, eventToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleAddStrain = () => {
        if (!newStrainName.trim()) {
            showToast("Please enter a strain name.", ToastType.Warning);
            return;
        }
        setStrains(prev => [...prev, { strainName: newStrainName, type: newStrainType }]);
        setNewStrainName('');
        setNewStrainType(StrainPreference.Hybrid);
    };

    const handleRemoveStrain = (index: number) => {
        setStrains(prev => prev.filter((_, i) => i !== index));
    };
    
    const handleSubmit = () => {
        if (!formData.title.trim() || !formData.date || !formData.time || !formData.location.trim() || !formData.description.trim()) {
            showToast("Please fill out all required fields.", ToastType.Error);
            return;
        }
        if (!currentUser) {
            showToast("You must be logged in.", ToastType.Error);
            return;
        }

        const sharedEventData = {
            ...formData,
            strainsOnDeck: strains.map((s, i) => ({
                ...s, 
                id: eventToEdit?.strainsOnDeck[i]?.id || `s${Date.now()}${Math.random()}`, 
                userId: currentUser.id
            })),
            tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        };

        if (isEditMode) {
            onUpdateEvent(eventToEdit.id, sharedEventData);
        } else {
            const newEvent: Event = {
                ...sharedEventData,
                id: `e${Date.now()}`,
                hostId: currentUser.id,
                attendees: [currentUser.id],
            };
            onCreateEvent(newEvent);
        }
        
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
        <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? "Edit Your Session" : "Create a New Session"}>
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
                        {strains.map((s, i) => (
                            <StrainPill key={i} strain={{...s, id: `temp-${i}`, userId: currentUser?.id || ''}} onRemove={() => handleRemoveStrain(i)} />
                        ))}
                    </div>
                </div>
                
                <Button onClick={handleSubmit} className="w-full mt-4">
                    {isEditMode ? 'Update Session' : 'Publish Session'}
                </Button>
            </div>
        </Modal>
    )
}

export default EventEditorModal;

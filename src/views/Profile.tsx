
import React, { useContext, useState, useEffect } from 'react';
import { AppContext, ToastType } from '../context/AppContext';
import Button from '../components/ui/Button';
import { StrainPreference, ConsumptionMethod, User } from '../types';
import Input from '../components/ui/Input';
import { LogOutIcon, QuestionMarkCircleIcon } from '../components/icons';

const Profile: React.FC = () => {
    const { currentUser, updateUserProfile, showToast, onLogout, setHowItWorksModalOpen } = useContext(AppContext);
    const [isEditing, setIsEditing] = useState(false);
    
    const [editedData, setEditedData] = useState({
        bio: '',
        location: '',
        vibe: {
            strainPreference: [] as StrainPreference[],
            consumptionMethod: [] as ConsumptionMethod[],
        }
    });

    useEffect(() => {
        if (currentUser) {
            setEditedData({
                bio: currentUser.bio,
                location: currentUser.location,
                vibe: currentUser.vibe,
            });
        }
    }, [currentUser]);

    if (!currentUser) {
        return <div className="text-center p-8">Loading profile...</div>;
    }

    const handleEdit = () => {
        setEditedData({
            bio: currentUser.bio,
            location: currentUser.location,
            vibe: currentUser.vibe,
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = () => {
        if (updateUserProfile(currentUser.id, editedData)) {
            showToast('Profile updated successfully!', ToastType.Success);
        }
        setIsEditing(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleVibeChange = (action: React.SetStateAction<User['vibe'] | null>) => {
        setEditedData(prev => {
            const newVibe = typeof action === 'function' ? action(prev.vibe) : action;
            return { ...prev, vibe: newVibe || prev.vibe };
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-32 h-32 rounded-full border-4 border-brand-secondary" />
                    <div className="flex-grow text-center md:text-left">
                        <h1 className="text-4xl font-bold text-brand-primary tracking-wider">{currentUser.name}</h1>
                        
                        {isEditing ? (
                            <Input
                                name="location"
                                value={editedData.location}
                                onChange={handleInputChange}
                                className="mt-1 text-lg w-full md:w-auto"
                                placeholder="Your Location"
                            />
                        ) : (
                            <p className="text-brand-secondary mt-1">{currentUser.location}</p>
                        )}
                        
                        {isEditing ? (
                             <textarea
                                name="bio"
                                value={editedData.bio}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full bg-dark-bg border-2 border-brand-primary/30 rounded-md px-3 py-2 mt-4 text-dark-text placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-300"
                                placeholder="Tell us about your vibe..."
                            />
                        ) : (
                            <p className="text-dark-text/80 mt-4">{currentUser.bio}</p>
                        )}
                        {!isEditing && <Button variant="secondary" size="sm" className="mt-6" onClick={handleEdit}>Edit Profile</Button>}
                    </div>
                </div>

                <div className="mt-10 border-t-2 border-brand-primary/20 pt-6">
                    <h2 className="text-2xl font-bold text-brand-primary mb-4">My Vibe</h2>
                    {isEditing ? (
                        <VibeEditor vibe={editedData.vibe} setVibe={handleVibeChange} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold text-brand-secondary mb-2">Preferred Strains</h3>
                                <div className="flex flex-wrap gap-2">
                                    {currentUser.vibe.strainPreference.map(pref => <Tag key={pref} label={pref} />)}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-brand-secondary mb-2">Consumption Methods</h3>
                                <div className="flex flex-wrap gap-2">
                                    {currentUser.vibe.consumptionMethod.map(method => <Tag key={method} label={method} />)}
                                </div>
                            </div>
                        </div>
                    )}
                     {isEditing && (
                        <div className="flex items-center gap-4 mt-6">
                            <Button onClick={handleSave}>Save Changes</Button>
                            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 space-y-4">
                 <Button 
                    variant="secondary" 
                    onClick={() => setHowItWorksModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2"
                >
                    <QuestionMarkCircleIcon className="w-5 h-5" />
                    How It Works
                </Button>
                <Button 
                    variant="destructive" 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2"
                >
                    <LogOutIcon className="w-5 h-5" />
                    Log Out
                </Button>
            </div>
        </div>
    );
};

interface VibeEditorProps {
    vibe: User['vibe'];
    setVibe: React.Dispatch<React.SetStateAction<User['vibe'] | null>>;
}

const VibeEditor: React.FC<VibeEditorProps> = ({ vibe, setVibe }) => {

    const handleStrainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const pref = value as StrainPreference;
        setVibe(prev => {
            if (!prev) return null;
            const currentPrefs = prev.strainPreference;
            if (checked) {
                return { ...prev, strainPreference: [...currentPrefs, pref] };
            } else {
                return { ...prev, strainPreference: currentPrefs.filter(p => p !== pref) };
            }
        });
    };

    const handleMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const method = value as ConsumptionMethod;
        setVibe(prev => {
            if (!prev) return null;
            const currentMethods = prev.consumptionMethod;
            if (checked) {
                return { ...prev, consumptionMethod: [...currentMethods, method] };
            } else {
                return { ...prev, consumptionMethod: currentMethods.filter(m => m !== method) };
            }
        });
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-semibold text-brand-secondary mb-2">Preferred Strains</h3>
                <div className="space-y-2">
                    {Object.values(StrainPreference).map(pref => (
                        <Checkbox
                            key={pref}
                            id={`strain-${pref}`}
                            label={pref}
                            value={pref}
                            checked={vibe.strainPreference.includes(pref)}
                            onChange={handleStrainChange}
                        />
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-brand-secondary mb-2">Consumption Methods</h3>
                <div className="space-y-2">
                    {Object.values(ConsumptionMethod).map(method => (
                        <Checkbox
                            key={method}
                            id={`method-${method}`}
                            label={method}
                            value={method}
                            checked={vibe.consumptionMethod.includes(method)}
                            onChange={handleMethodChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

const Checkbox: React.FC<{id: string, label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, value: string}> = ({ id, label, checked, onChange, value}) => (
    <label htmlFor={id} className="flex items-center space-x-3 cursor-pointer text-dark-text/80 hover:text-dark-text">
        <input 
            type="checkbox"
            id={id}
            value={value}
            checked={checked}
            onChange={onChange}
            className="w-4 h-4 bg-dark-surface border-brand-primary/50 rounded text-brand-primary focus:ring-2 focus:ring-brand-primary focus:ring-offset-dark-surface"
        />
        <span>{label}</span>
    </label>
)


const Tag: React.FC<{ label: string }> = ({ label }) => (
    <span className="bg-brand-primary/10 text-brand-primary text-xs font-semibold px-3 py-1 rounded-full">{label}</span>
);

export default Profile;

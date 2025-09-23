
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import Button from '../components/ui/Button';
import { MessageSquareIcon, UserPlusIcon } from '../components/icons';
import { User } from '../types';
import MiniUserCard from '../components/MiniUserCard';

const UserProfile: React.FC = () => {
    const { selectedUser, currentUser, startChat, users, setSelectedUser, sendCrewInvite } = useContext(AppContext);

    const vibeMatches = useMemo(() => {
        if (!selectedUser) return [];

        const calculateMatchScore = (userA: User, userB: User): number => {
            if (!userA || !userB || !userA.vibe || !userB.vibe) return 0;
            
            const sharedStrains = userA.vibe.strainPreference.filter(pref =>
                userB.vibe.strainPreference.includes(pref)
            ).length;

            const sharedMethods = userA.vibe.consumptionMethod.filter(method =>
                userB.vibe.consumptionMethod.includes(method)
            ).length;

            return sharedStrains + sharedMethods;
        };

        return users
            .filter(user => user.id !== selectedUser.id)
            .map(user => ({
                user,
                score: calculateMatchScore(selectedUser, user),
            }))
            .filter(match => match.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);
    }, [selectedUser, users]);

    if (!selectedUser) {
        return <div className="text-center p-8">User not found.</div>;
    }
    
    const isCurrentUser = currentUser?.id === selectedUser.id;
    const isFriend = currentUser?.crew.includes(selectedUser.id);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-32 h-32 rounded-full border-4 border-brand-secondary" />
                    <div className="flex-grow text-center md:text-left">
                        <h1 className="text-4xl font-bold text-brand-primary tracking-wider">{selectedUser.name}</h1>
                        <p className="text-brand-secondary mt-1">{selectedUser.location}</p>
                        <p className="text-dark-text/80 mt-4">{selectedUser.bio}</p>
                        {!isCurrentUser && (
                          <div className="mt-6 flex items-center gap-2">
                            <Button onClick={() => startChat(selectedUser.id)} size="sm" className="flex items-center gap-2">
                              <MessageSquareIcon className="w-4 h-4" />
                              Message {selectedUser.name.split(' ')[0]}
                            </Button>
                            {!isFriend && (
                               <Button onClick={() => sendCrewInvite(selectedUser.id)} variant="secondary" size="sm" className="flex items-center gap-2">
                                    <UserPlusIcon className="w-4 h-4" />
                                    Add to Crew
                               </Button>
                            )}
                          </div>
                        )}
                    </div>
                </div>

                <div className="mt-10 border-t-2 border-brand-primary/20 pt-6">
                    <h2 className="text-2xl font-bold text-brand-primary mb-4">{selectedUser.name.split(' ')[0]}'s Vibe</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold text-brand-secondary mb-2">Preferred Strains</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser.vibe.strainPreference.length > 0 
                                    ? selectedUser.vibe.strainPreference.map(pref => <Tag key={pref} label={pref} />)
                                    : <p className="text-sm text-dark-text/60">Not specified yet.</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-brand-secondary mb-2">Consumption Methods</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser.vibe.consumptionMethod.length > 0
                                    ? selectedUser.vibe.consumptionMethod.map(method => <Tag key={method} label={method} />)
                                    : <p className="text-sm text-dark-text/60">Not specified yet.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 border-t-2 border-brand-primary/20 pt-6">
                    <h2 className="text-2xl font-bold text-brand-primary mb-4">Vibe Matches</h2>
                    {vibeMatches.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {vibeMatches.map(({ user, score }) => (
                                <MiniUserCard 
                                    key={user.id} 
                                    user={user} 
                                    matchScore={score}
                                    onClick={() => setSelectedUser(user.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-dark-text/60">No similar vibes found yet. Check back later!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const Tag: React.FC<{ label: string }> = ({ label }) => (
    <span className="bg-brand-primary/10 text-brand-primary text-xs font-semibold px-3 py-1 rounded-full">{label}</span>
);

export default UserProfile;

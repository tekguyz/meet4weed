import React, { useContext } from 'react';
import { User } from '../types';
import Button from './ui/Button';
import { AppContext } from '../context/AppContext';

interface UserCardProps {
  user: User;
}

const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const { setSelectedUser } = useContext(AppContext);

  return (
    <div className="bg-dark-surface border-2 border-brand-primary/20 rounded-lg p-4 text-center transition-all duration-300 hover:border-brand-primary hover:shadow-glow-primary flex flex-col">
      <img src={user.avatarUrl} alt={user.name} className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-brand-secondary" />
      <h3 className="text-lg font-bold text-brand-primary">{user.name}</h3>
      <p className="text-sm text-brand-secondary mb-2">{user.location}</p>
      <p className="text-xs text-dark-text/70 mb-4 h-12 overflow-hidden flex-grow">{user.bio}</p>
      <Button variant="secondary" size="sm" onClick={() => setSelectedUser(user.id)}>View Profile</Button>
    </div>
  );
};

export default UserCard;

import React from 'react';
import { User } from '../types';

interface MiniUserCardProps {
  user: User;
  matchScore: number;
  onClick: () => void;
}

const MiniUserCard: React.FC<MiniUserCardProps> = ({ user, matchScore, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-dark-bg/50 p-3 rounded-lg flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:bg-dark-surface hover:shadow-glow-secondary w-full"
    >
      <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full mb-2 border-2 border-brand-secondary" />
      <h4 className="font-semibold text-sm text-dark-text truncate w-full">{user.name}</h4>
      <p className="text-xs text-brand-secondary">{matchScore} {matchScore === 1 ? 'vibe' : 'vibes'} in common</p>
    </div>
  );
};

export default MiniUserCard;

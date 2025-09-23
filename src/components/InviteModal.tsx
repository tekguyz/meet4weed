
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { User } from '../types';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import { SearchIcon, SendIcon } from './icons';
import { cn } from '../lib/utils';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userIds: string[]) => void;
  title: string;
  existingParticipantIds?: string[];
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onInvite, title, existingParticipantIds = [] }) => {
  const { users, currentUser } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const filteredUsers = useMemo(() => {
    if (!currentUser) return [];
    return users.filter(user =>
      user.id !== currentUser.id &&
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, currentUser, searchQuery]);

  const handleToggleSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSendInvites = () => {
    if (selectedUserIds.size === 0) return;
    onInvite(Array.from(selectedUserIds));
    onClose();
  };
  
  // Reset state when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedUserIds(new Set());
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col space-y-4" style={{minHeight: '400px'}}>
        <div className="relative">
          <Input 
            placeholder="Search for users..." 
            className="pl-10" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary/50" />
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2">
          {filteredUsers.length > 0 ? filteredUsers.map(user => {
            const isSelected = selectedUserIds.has(user.id);
            const isParticipant = existingParticipantIds.includes(user.id);
            return (
              <div 
                key={user.id}
                onClick={() => !isParticipant && handleToggleSelection(user.id)}
                className={cn(
                  "flex items-center p-2 rounded-lg transition-colors duration-200",
                  isParticipant ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  isSelected ? "bg-brand-primary/20" : "hover:bg-dark-surface"
                )}
              >
                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full mr-3" />
                <div className="flex-grow">
                  <p className="font-semibold text-dark-text">{user.name}</p>
                  <p className="text-xs text-dark-text/60">{user.location}</p>
                </div>
                {isParticipant ? (
                  <span className="text-xs text-brand-secondary">Attending</span>
                ) : (
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    isSelected ? "bg-brand-primary border-brand-primary" : "border-brand-primary/50"
                  )}>
                    {isSelected && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                )}
              </div>
            )
          }) : (
            <div className="text-center py-8 text-dark-text/70">
              <p>No users found.</p>
            </div>
          )}
        </div>
        
        <Button onClick={handleSendInvites} disabled={selectedUserIds.size === 0} className="w-full flex items-center justify-center gap-2">
          <SendIcon className="w-5 h-5" />
          Send Invite{selectedUserIds.size > 1 ? 's' : ''} ({selectedUserIds.size})
        </Button>
      </div>
    </Modal>
  );
};

export default InviteModal;

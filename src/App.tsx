
import React, { useContext } from 'react';
import { AppContext } from './context/AppContext';
import { Page } from './types';
import { cn } from './lib/utils';

import Header from './components/Header';
import ToastContainer from './components/ui/Toast';
import Modal from './components/ui/Modal';
import BottomNavBar from './components/BottomNavBar';

import Login from './views/Login';
import Home from './views/Home';
import Messaging from './views/Messaging';
import Profile from './views/Profile';
import UserProfile from './views/UserProfile';
import EventDetails from './views/EventDetails';
import NotFound from './views/NotFound';

const App: React.FC = () => {
  const { 
    isAuthenticated, 
    currentPage, 
    isHowItWorksModalOpen, 
    setHowItWorksModalOpen,
    selectedConversation,
    setSelectedConversation,
    selectedUser,
    onNavigate,
    users,
    currentUser,
  } = useContext(AppContext);

  const getHeaderTitle = (): string => {
    switch (currentPage) {
      case Page.Home: return 'Upcoming Sessions';
      case Page.Messaging:
        if (selectedConversation) {
            const otherUserId = selectedConversation.participantIds.find(id => id !== currentUser?.id);
            const otherUser = users.find(u => u.id === otherUserId);
            return otherUser?.name || 'Chat';
        }
        return 'Chats';
      case Page.Profile: return 'My Profile';
      case Page.UserProfile: return selectedUser?.name || 'Profile';
      case Page.EventDetails: return 'Session Details';
      default: return 'Meet4Weed';
    }
  }

  const getOnBack = (): (() => void) | undefined => {
    switch (currentPage) {
        case Page.Messaging:
            return selectedConversation ? () => setSelectedConversation(null) : undefined;
        case Page.UserProfile:
        case Page.EventDetails:
            return () => onNavigate(Page.Home);
        default:
            return undefined;
    }
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case Page.Home:
        return <Home />;
      case Page.Messaging:
        return <Messaging />;
      case Page.Profile:
        return <Profile />;
      case Page.UserProfile:
        return <UserProfile />;
      case Page.EventDetails:
        return <EventDetails />;
      case Page.Login: // Should not happen if authenticated, but good practice
        return <Home />;
      case Page.NotFound:
      default:
        return <NotFound />;
    }
  };

  if (!isAuthenticated) {
    return (
        <>
            <Login />
            <ToastContainer />
        </>
    );
  }

  const hasPageSpecificLayout = currentPage === Page.Messaging;

  return (
    <div className="flex flex-col h-screen bg-dark-bg">
      <Header title={getHeaderTitle()} onBack={getOnBack()} />
      <main className={cn(
        "flex-grow",
        hasPageSpecificLayout ? "overflow-y-hidden" : "overflow-y-auto pb-24"
      )}>
        <div className={hasPageSpecificLayout ? "h-full" : ""}>
          {renderCurrentPage()}
        </div>
      </main>
      <BottomNavBar />
      <ToastContainer />
      <HowItWorksModal isOpen={isHowItWorksModalOpen} onClose={() => setHowItWorksModalOpen(false)} />
    </div>
  );
};

const HowItWorksModal: React.FC<{isOpen: boolean, onClose: () => void}> = ({isOpen, onClose}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="How It Works">
            <div className="text-sm space-y-4 text-dark-text/90">
                <p>Welcome to <span className="text-brand-primary font-bold">Meet4Weed</span>, the exclusive hub for Florida's medical cannabis community.</p>
                <ol className="list-decimal list-inside space-y-2">
                    <li><strong className="text-brand-secondary">Get Verified:</strong> Use our AI-powered system to securely verify your FL OMMU card for safe access.</li>
                    <li><strong className="text-brand-secondary">Discover Sessions:</strong> Browse and RSVP to private get-togethers hosted by other verified members.</li>
                    <li><strong className="text-brand-secondary">Host Your Own:</strong> Create sessions, from chill game nights to creative workshops.</li>
                    <li><strong className="text-brand-secondary">Manage Your Vibe:</strong> As a host, you can easily edit details or cancel a session, automatically notifying all attendees of any changes.</li>
                    <li><strong className="text-brand-secondary">Connect & Chat:</strong> Message other users to coordinate details and build your trusted crew.</li>
                </ol>
                <p>It's all about finding your vibe in a safe, private, and verified community.</p>
            </div>
        </Modal>
    )
}

export default App;

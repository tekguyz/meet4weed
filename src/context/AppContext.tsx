import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { User, Event, Message, Conversation, Page, Toast, ToastType } from '../types';
import { USERS, EVENTS, MESSAGES, CONVERSATIONS } from '../constants';

// For convenience, we export ToastType from here as well.
export { ToastType };

interface AppContextState {
  isAuthenticated: boolean;
  currentUser: User | null;
  currentPage: Page;
  users: User[];
  events: Event[];
  conversations: Conversation[];
  selectedEvent: Event | null;
  selectedUser: User | null;
  selectedConversation: Conversation | null;
  toasts: Toast[];
  isHowItWorksModalOpen: boolean;
  isLoading: boolean;
  setHowItWorksModalOpen: (isOpen: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  handleLogin: (email: string, pass: string) => boolean;
  handleSignUp: (details: any) => boolean;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  onCreateEvent: (event: Omit<Event, 'id' | 'hostId' | 'attendees' | 'strainsOnDeck'>) => void;
  onRsvp: (eventId: string, userId: string) => void;
  onUnRsvp: (eventId: string, userId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  startChat: (recipientId: string) => void;
  setSelectedEvent: (eventId: string | null) => void;
  setSelectedUser: (userId: string | null) => void;
  setSelectedConversation: (conversationId: string | null) => void;
  updateUserProfile: (userId: string, updates: Partial<User>) => boolean;
}

export const AppContext = createContext<AppContextState>({} as AppContextState);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(Page.Login);
  
  const [users, setUsers] = useState<User[]>(USERS);
  const [events, setEvents] = useState<Event[]>(EVENTS);
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isHowItWorksModalOpen, setHowItWorksModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Simulate initial data fetch
    if (isAuthenticated) {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500); // 1.5 second delay
        return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  const showToast = (message: string, type: ToastType) => {
    const newToast: Toast = { id: Date.now(), message, type };
    setToasts(prevToasts => [...prevToasts, newToast]);
  };
  
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prevToasts => prevToasts.slice(1));
      }, 3000); // Remove toast after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  const handleLogin = (email: string, pass: string): boolean => {
    const user = users.find(u => u.email === email);
    // Dummy password check
    if (user && pass === 'password') {
      setIsAuthenticated(true);
      setCurrentUser(user);
      setCurrentPage(Page.Home);
      showToast(`Welcome back, ${user.name}!`, ToastType.Success);
      return true;
    }
    showToast('Invalid email or password.', ToastType.Error);
    return false;
  };
  
  const handleSignUp = (details: {name: string, email: string}): boolean => {
    const newUser: User = {
        id: `u${users.length + 1}`,
        name: details.name,
        email: details.email,
        avatarUrl: `https://picsum.photos/seed/u${users.length + 1}/200`,
        bio: 'New member of the crew! Ready for good vibes.',
        location: 'Florida, USA',
        vibe: {
            strainPreference: [],
            consumptionMethod: [],
        },
        crew: [],
    };
    setUsers(prev => [...prev, newUser]);
    setIsAuthenticated(true);
    setCurrentUser(newUser);
    setCurrentPage(Page.Home);
    showToast(`Welcome to the crew, ${newUser.name}!`, ToastType.Success);
    return true;
  }

  const onLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPage(Page.Login);
    showToast('You have been logged out.', ToastType.Success);
  };
  
  const onNavigate = (page: Page) => {
    setCurrentPage(page);
    setSelectedEventId(null);
    setSelectedUserId(null);
  };

  const setSelectedEvent = (eventId: string | null) => {
    setSelectedEventId(eventId);
    if (eventId) {
      setCurrentPage(Page.EventDetails);
    }
  };
  
  const setSelectedUser = (userId: string | null) => {
    setSelectedUserId(userId);
    if (userId) {
      setCurrentPage(Page.UserProfile);
    }
  };

  const setSelectedConversation = (conversationId: string | null) => {
    setSelectedConversationId(conversationId);
  };

  const onCreateEvent = (eventData: Omit<Event, 'id' | 'hostId' | 'attendees' | 'strainsOnDeck'>) => {
    if (!currentUser) return;
    const newEvent: Event = {
      ...eventData,
      id: `e${Date.now()}`,
      hostId: currentUser.id,
      attendees: [],
      strainsOnDeck: [],
    };
    setEvents(prev => [newEvent, ...prev]);
    showToast('Session created successfully!', ToastType.Success);
  };
  
  const onRsvp = (eventId: string, userId: string) => {
    setEvents(prevEvents => prevEvents.map(event => {
      if (event.id === eventId && !event.attendees.includes(userId)) {
        showToast(`You're going to "${event.title}"!`, ToastType.Success);
        return { ...event, attendees: [...event.attendees, userId] };
      }
      return event;
    }));
  };

  const onUnRsvp = (eventId: string, userId: string) => {
    setEvents(prevEvents => prevEvents.map(event => {
      if(event.id === eventId) {
        showToast(`RSVP to "${event.title}" cancelled.`, ToastType.Warning);
        return { ...event, attendees: event.attendees.filter(id => id !== userId) };
      }
      return event;
    }));
  }

  const sendMessage = (conversationId: string, text: string) => {
    if (!currentUser || !text.trim()) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      senderId: currentUser.id,
      text,
      timestamp: new Date().toISOString(),
    };
    
    setConversations(prev => prev.map(convo => {
      if (convo.id === conversationId) {
        return { ...convo, messages: [...convo.messages, newMessage] };
      }
      return convo;
    }));
  };

  const startChat = (recipientId: string) => {
    if (!currentUser) return;
    const existingConvo = conversations.find(c => 
      c.participantIds.length === 2 && c.participantIds.includes(currentUser.id) && c.participantIds.includes(recipientId)
    );

    if (existingConvo) {
      setSelectedConversationId(existingConvo.id);
    } else {
      const newConvoId = `c${Date.now()}`;
      const newConvo: Conversation = {
        id: newConvoId,
        participantIds: [currentUser.id, recipientId],
        messages: [],
      };
      setConversations(prev => [newConvo, ...prev]);
      setSelectedConversationId(newConvoId);
    }
    setCurrentPage(Page.Messaging);
  };

  const updateUserProfile = (userId: string, updates: Partial<User>): boolean => {
    let updatedUser: User | undefined;
    setUsers(prevUsers => prevUsers.map(user => {
        if (user.id === userId) {
            updatedUser = { ...user, ...updates };
            return updatedUser;
        }
        return user;
    }));
    
    if (currentUser?.id === userId && updatedUser) {
        setCurrentUser(updatedUser);
    }
    return true;
  };
  
  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  const selectedUser = users.find(u => u.id === selectedUserId) || null;
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;

  const value: AppContextState = {
    isAuthenticated,
    currentUser,
    currentPage,
    users,
    events,
    conversations,
    selectedEvent,
    selectedUser,
    selectedConversation,
    toasts,
    isHowItWorksModalOpen,
    isLoading,
    setHowItWorksModalOpen,
    showToast,
    handleLogin,
    handleSignUp,
    onLogout,
    onNavigate,
    onCreateEvent,
    onRsvp,
    onUnRsvp,
    sendMessage,
    startChat,
    setSelectedEvent,
    setSelectedUser,
    setSelectedConversation,
    updateUserProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
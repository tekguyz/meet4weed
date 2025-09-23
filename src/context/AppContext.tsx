
import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { User, Event, Message, Conversation, Page, Toast, ToastType, Notification, NotificationType, StrainContribution } from '../types';
import { USERS, EVENTS, MESSAGES, CONVERSATIONS, NOTIFICATIONS } from '../constants';

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
  notifications: Notification[];
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  setHowItWorksModalOpen: (isOpen: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  handleLogin: (email: string, pass: string) => boolean;
  handleSignUp: (details: any) => boolean;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  onCreateEvent: (event: Event) => void;
  onUpdateEvent: (eventId: string, updates: Partial<Omit<Event, 'id' | 'hostId' | 'attendees'>>) => void;
  onDeleteEvent: (eventId: string) => void;
  onRsvp: (eventId: string, userId: string) => void;
  onUnRsvp: (eventId: string, userId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  startChat: (recipientId: string) => void;
  setSelectedEvent: (eventId: string | null) => void;
  setSelectedUser: (userId: string | null) => void;
  setSelectedConversation: (conversationId: string | null) => void;
  updateUserProfile: (userId: string, updates: Partial<User>) => boolean;
  addStrainContribution: (eventId: string, strain: Omit<StrainContribution, 'id' | 'userId'>) => void;
  removeStrainContribution: (eventId: string, strainId: string) => void;
  sendCrewInvite: (recipientId: string) => void;
  sendEventInvites: (eventId: string, recipientIds: string[]) => void;
  acceptCrewInvite: (notificationId: string) => void;
}

export const AppContext = createContext<AppContextState>({} as AppContextState);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>(Page.Login);
  
  const [users, setUsers] = useState<User[]>(USERS);
  const [events, setEvents] = useState<Event[]>(EVENTS);
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS);
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

  // Event Reminder Notifications
  useEffect(() => {
    if (!currentUser) return;

    const reminderNotifications: Notification[] = [];
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    events.forEach(event => {
      if (event.attendees.includes(currentUser.id)) {
        const eventDate = new Date(event.date);
        const timeDiff = eventDate.getTime() - now.getTime();

        if (timeDiff > 0 && timeDiff <= oneDayInMs) {
          const existingReminder = notifications.find(n => 
              n.type === NotificationType.EventReminder && 
              n.relatedId === event.id && 
              n.userId === currentUser.id
          );
          
          if (!existingReminder) {
            reminderNotifications.push({
              id: `notif-reminder-${event.id}-${currentUser.id}`,
              userId: currentUser.id,
              type: NotificationType.EventReminder,
              message: `Reminder: Your session "${event.title}" is starting soon.`,
              relatedId: event.id,
              timestamp: new Date().toISOString(),
              isRead: false,
            });
          }
        }
      }
    });

    if (reminderNotifications.length > 0) {
      setNotifications(prev => [...reminderNotifications, ...prev]);
    }
  }, [currentUser, events]);

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

  const onCreateEvent = (newEvent: Event) => {
    if (!currentUser) return;
    setEvents(prev => [newEvent, ...prev]);
    showToast('Session created successfully!', ToastType.Success);
  };

  const onUpdateEvent = (eventId: string, updates: Partial<Omit<Event, 'id' | 'hostId' | 'attendees'>>) => {
    let updatedEvent: Event | undefined;
    setEvents(prev => prev.map(e => {
        if (e.id === eventId) {
            updatedEvent = { ...e, ...updates };
            return updatedEvent;
        }
        return e;
    }));

    if (updatedEvent) {
        const attendeesToNotify = updatedEvent.attendees.filter(id => id !== updatedEvent!.hostId);
        const newNotifications: Notification[] = attendeesToNotify.map(userId => ({
            id: `notif-update-${Date.now()}-${userId}`,
            userId: userId,
            senderId: currentUser?.id,
            type: NotificationType.EventUpdated,
            message: `The session "${updatedEvent!.title}" has been updated.`,
            relatedId: updatedEvent!.id,
            timestamp: new Date().toISOString(),
            isRead: false,
        }));
        setNotifications(prev => [...newNotifications, ...prev]);
        showToast('Session updated successfully!', ToastType.Success);
    }
  };

  const onDeleteEvent = (eventId: string) => {
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    const attendeesToNotify = eventToDelete.attendees.filter(id => id !== eventToDelete!.hostId);
    const newNotifications: Notification[] = attendeesToNotify.map(userId => ({
        id: `notif-cancel-${Date.now()}-${userId}`,
        userId: userId,
        senderId: currentUser?.id,
        type: NotificationType.EventCancelled,
        message: `The session "${eventToDelete!.title}" has been cancelled.`,
        relatedId: '', // Event is deleted, so no relatedId
        timestamp: new Date().toISOString(),
        isRead: false,
    }));
    setNotifications(prev => [...newNotifications, ...prev]);

    setEvents(prev => prev.filter(e => e.id !== eventId));
    
    // If the user is viewing the deleted event, navigate them away
    if (selectedEventId === eventId) {
        onNavigate(Page.Home);
    }

    showToast('Session cancelled.', ToastType.Warning);
  };
  
  const onRsvp = (eventId: string, userId: string) => {
    const event = events.find(e => e.id === eventId);
    const rsvpingUser = users.find(u => u.id === userId);

    if (event && rsvpingUser && event.hostId !== userId) {
        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            userId: event.hostId,
            senderId: userId,
            type: NotificationType.NewRsvp,
            message: `${rsvpingUser.name} has RSVP'd to your session "${event.title}".`,
            relatedId: event.id,
            timestamp: new Date().toISOString(),
            isRead: false,
        };
        setNotifications(prev => [newNotification, ...prev]);
    }

    setEvents(prevEvents => prevEvents.map(e => {
      if (e.id === eventId && !e.attendees.includes(userId)) {
        showToast(`You're going to "${e.title}"!`, ToastType.Success);
        return { ...e, attendees: [...e.attendees, userId] };
      }
      return e;
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

  const addStrainContribution = (eventId: string, strain: Omit<StrainContribution, 'id' | 'userId'>) => {
    if (!currentUser) return;
    const newContribution: StrainContribution = {
      ...strain,
      id: `s${Date.now()}`,
      userId: currentUser.id,
    };
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, strainsOnDeck: [...e.strainsOnDeck, newContribution] } : e
    ));
  };

  const removeStrainContribution = (eventId: string, strainId: string) => {
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, strainsOnDeck: e.strainsOnDeck.filter(s => s.id !== strainId) } : e
    ));
  };

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
    ));
  };
  
  const markAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setNotifications(prev => prev.map(n => 
        n.userId === currentUser.id ? { ...n, isRead: true } : n
    ));
  };

  const sendCrewInvite = (recipientId: string) => {
    if (!currentUser || currentUser.id === recipientId) return;

    const newNotification: Notification = {
      id: `notif-crew-${Date.now()}`,
      userId: recipientId,
      senderId: currentUser.id,
      type: NotificationType.CrewInvite,
      message: `${currentUser.name} wants to add you to their crew.`,
      relatedId: currentUser.id, // Related ID is the sender
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
    showToast('Crew invite sent!', ToastType.Success);
  }

  const sendEventInvites = (eventId: string, recipientIds: string[]) => {
    if (!currentUser) return;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const newNotifications: Notification[] = recipientIds.map(userId => ({
      id: `notif-event-${Date.now()}-${userId}`,
      userId: userId,
      senderId: currentUser.id,
      type: NotificationType.EventInvite,
      message: `${currentUser.name} invited you to "${event.title}".`,
      relatedId: event.id,
      timestamp: new Date().toISOString(),
      isRead: false,
    }));
    
    setNotifications(prev => [...newNotifications, ...prev]);
    showToast(`Sent ${recipientIds.length} invite(s)!`, ToastType.Success);
  }

  const acceptCrewInvite = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || !notification.senderId || !currentUser) return;

    const senderId = notification.senderId;
    const recipientId = currentUser.id;

    // Add each user to the other's crew
    setUsers(prev => prev.map(user => {
      if (user.id === senderId) {
        return { ...user, crew: [...new Set([...user.crew, recipientId])] };
      }
      if (user.id === recipientId) {
        const updatedUser = { ...user, crew: [...new Set([...user.crew, senderId])] };
        setCurrentUser(updatedUser); // Update current user state as well
        return updatedUser;
      }
      return user;
    }));

    // Remove notification
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    const sender = users.find(u => u.id === senderId);
    showToast(`You and ${sender?.name || 'user'} are now in each other's crew!`, ToastType.Success);
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
    notifications,
    setHowItWorksModalOpen,
    showToast,
    handleLogin,
    handleSignUp,
    onLogout,
    onNavigate,
    onCreateEvent,
    onUpdateEvent,
    onDeleteEvent,
    onRsvp,
    onUnRsvp,
    sendMessage,
    startChat,
    setSelectedEvent,
    setSelectedUser,
    setSelectedConversation,
    updateUserProfile,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    addStrainContribution,
    removeStrainContribution,
    sendCrewInvite,
    sendEventInvites,
    acceptCrewInvite,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
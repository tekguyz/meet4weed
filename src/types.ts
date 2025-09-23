
export enum Page {
  Home = 'HOME',
  Messaging = 'MESSAGING',
  Profile = 'PROFILE',
  UserProfile = 'USER_PROFILE',
  EventDetails = 'EVENT_DETAILS',
  Login = 'LOGIN',
  NotFound = 'NOT_FOUND',
}

export enum EventType {
  Chill = 'Chill & Relax',
  Creative = 'Creative Sesh',
  Gaming = 'Game Night',
  Outdoor = 'Outdoor Adventure',
  Music = 'Music & Vibes',
}

export enum StrainPreference {
  Indica = 'Indica',
  Sativa = 'Sativa',
  Hybrid = 'Hybrid',
  Any = 'Any',
}

export enum ConsumptionMethod {
  Flower = 'Flower',
  Vape = 'Vape',
  Edibles = 'Edibles',
  Dabs = 'Dabs',
  Any = 'Any',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  location: string;
  vibe: {
    strainPreference: StrainPreference[];
    consumptionMethod: ConsumptionMethod[];
  };
  crew: string[]; // array of user IDs
}

export interface StrainContribution {
  id: string;
  userId: string;
  strainName: string;
  type: StrainPreference;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  date: string;
  time: string;
  location: string; // Could be "Private Residence, Orlando" or similar
  hostId: string;
  attendees: string[]; // array of user IDs
  strainsOnDeck: StrainContribution[];
  tags: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  messages: Message[];
}

export enum ToastType {
    Success = 'SUCCESS',
    Error = 'ERROR',
    Warning = 'WARNING'
}

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

export enum NotificationType {
  NewRsvp = 'NEW_RSVP',
  EventReminder = 'EVENT_REMINDER',
  CrewInvite = 'CREW_INVITE',
  EventInvite = 'EVENT_INVITE',
  EventUpdated = 'EVENT_UPDATED',
  EventCancelled = 'EVENT_CANCELLED',
}

export interface Notification {
  id: string;
  userId: string; // The user who should receive the notification
  senderId?: string; // The user who triggered the notification (e.g., sent the invite)
  type: NotificationType;
  message: string;
  relatedId: string; // ID of the event or user
  timestamp: string;
  isRead: boolean;
}
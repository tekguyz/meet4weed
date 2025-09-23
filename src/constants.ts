import { User, Event, Message, Conversation, EventType, StrainPreference, ConsumptionMethod, Notification } from './types';

export const USERS: User[] = [
  {
    id: 'u1',
    name: 'NeonRyder',
    email: 'ryder@example.com',
    avatarUrl: 'https://picsum.photos/seed/u1/200',
    bio: 'Digital nomad exploring the intersection of tech and nature. Always down for a creative sesh.',
    location: 'Miami, FL',
    vibe: {
      strainPreference: [StrainPreference.Sativa, StrainPreference.Hybrid],
      consumptionMethod: [ConsumptionMethod.Vape, ConsumptionMethod.Flower],
    },
    crew: ['u2', 'u3'],
  },
  {
    id: 'u2',
    name: 'GlitchWitch',
    email: 'glitch@example.com',
    avatarUrl: 'https://picsum.photos/seed/u2/200',
    bio: 'Gamer, coder, and indica enthusiast. Looking for chill game nights and deep conversations.',
    location: 'Orlando, FL',
    vibe: {
      strainPreference: [StrainPreference.Indica],
      consumptionMethod: [ConsumptionMethod.Flower, ConsumptionMethod.Edibles],
    },
    crew: ['u1', 'u7'],
  },
  {
    id: 'u3',
    name: 'SynthWaveSurfer',
    email: 'synth@example.com',
    avatarUrl: 'https://picsum.photos/seed/u3/200',
    bio: 'Music producer and outdoor explorer. Let\'s find a vibe and create something new.',
    location: 'Tampa, FL',
    vibe: {
      strainPreference: [StrainPreference.Hybrid],
      consumptionMethod: [ConsumptionMethod.Dabs, ConsumptionMethod.Vape],
    },
    crew: ['u1', 'u4', 'u5', 'u8'],
  },
  {
    id: 'u4',
    name: 'CosmicChef',
    email: 'chef@example.com',
    avatarUrl: 'https://picsum.photos/seed/u4/200',
    bio: 'Infusing good food with good vibes. Host of the tastiest get-togethers.',
    location: 'Jacksonville, FL',
    vibe: {
      strainPreference: [StrainPreference.Any],
      consumptionMethod: [ConsumptionMethod.Edibles, ConsumptionMethod.Flower],
    },
    crew: ['u3'],
  },
  {
    id: 'u5',
    name: 'TerraTrekker',
    email: 'terra@example.com',
    avatarUrl: 'https://picsum.photos/seed/u5/200',
    bio: 'Hiking trails and beach days are my jam. Looking for fellow adventurers to explore Florida\'s natural beauty.',
    location: 'St. Petersburg, FL',
    vibe: {
      strainPreference: [StrainPreference.Sativa],
      consumptionMethod: [ConsumptionMethod.Vape],
    },
    crew: ['u3'],
  },
  {
    id: 'u6',
    name: 'ChromaCanvas',
    email: 'chroma@example.com',
    avatarUrl: 'https://picsum.photos/seed/u6/200',
    bio: 'Painter and digital artist. Let\'s get inspired and create something beautiful. Open to collabs.',
    location: 'Sarasota, FL',
    vibe: {
      strainPreference: [StrainPreference.Hybrid, StrainPreference.Sativa],
      consumptionMethod: [ConsumptionMethod.Flower, ConsumptionMethod.Edibles],
    },
    crew: ['u1', 'u3'],
  },
  {
    id: 'u7',
    name: 'ByteBard',
    email: 'byte@example.com',
    avatarUrl: 'https://picsum.photos/seed/u7/200',
    bio: 'Software dev by day, hardware tinkerer by night. Interested in deep talks about AI, ethics, and the future of tech.',
    location: 'Gainesville, FL',
    vibe: {
      strainPreference: [StrainPreference.Indica, StrainPreference.Hybrid],
      consumptionMethod: [ConsumptionMethod.Flower],
    },
    crew: ['u2'],
  },
  {
    id: 'u8',
    name: 'BeatDropper',
    email: 'beats@example.com',
    avatarUrl: 'https://picsum.photos/seed/u8/200',
    bio: 'DJ spinning everything from lo-fi to house. Always looking for new tracks and people to share them with.',
    location: 'Miami, FL',
    vibe: {
      strainPreference: [StrainPreference.Any],
      consumptionMethod: [ConsumptionMethod.Dabs, ConsumptionMethod.Vape],
    },
    crew: ['u1', 'u3'],
  },
];

export const EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Backyard Nebula Gazing',
    description: 'Got a new telescope and some spacey hybrids. Let\'s get lost in the cosmos from the comfort of my backyard. Low-key, high-minded.',
    eventType: EventType.Chill,
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '9:00 PM',
    location: 'Private Residence, Miami',
    hostId: 'u1',
    attendees: ['u2', 'u3', 'u8'],
    strainsOnDeck: [
      { id: 's1', userId: 'u1', strainName: 'Stardawg', type: StrainPreference.Hybrid },
      { id: 's2', userId: 'u2', strainName: 'Northern Lights', type: StrainPreference.Indica },
    ],
    tags: ['stargazing', 'chill', 'outdoors'],
  },
  {
    id: 'e2',
    title: 'Pixelated Dreams Arcade Night',
    description: 'Who\'s ready for some retro gaming? Firing up the classic consoles and arcade machine. Winner gets bragging rights, everyone gets good vibes.',
    eventType: EventType.Gaming,
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '7:00 PM',
    location: 'Private Residence, Orlando',
    hostId: 'u2',
    attendees: ['u1', 'u4', 'u7'],
    strainsOnDeck: [
        { id: 's3', userId: 'u2', strainName: 'Granddaddy Purple', type: StrainPreference.Indica },
    ],
    tags: ['gaming', 'retro', 'competition'],
  },
  {
    id: 'e3',
    title: 'Synth & Sketch',
    description: 'Bringing my synth rig and some art supplies out. Whether you draw, write, or just want to vibe to some live electronic tunes, come hang. No pressure, just creation.',
    eventType: EventType.Creative,
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '6:00 PM',
    location: 'Private Studio, Tampa',
    hostId: 'u3',
    attendees: ['u1', 'u6'],
    strainsOnDeck: [
      { id: 's4', userId: 'u3', strainName: 'Sour Diesel', type: StrainPreference.Sativa },
    ],
    tags: ['music', 'art', 'creative'],
  },
  {
    id: 'e4',
    title: 'Gourmet Gummy Crafting',
    description: 'Learn the art of infusion! I\'ll be teaching a small group how to make delicious, perfectly dosed gourmet edibles. All materials provided.',
    eventType: EventType.Creative,
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '2:00 PM',
    location: 'Private Kitchen, Jacksonville',
    hostId: 'u4',
    attendees: ['u2'],
    strainsOnDeck: [
      { id: 's5', userId: 'u4', strainName: 'Runtz', type: StrainPreference.Hybrid },
    ],
    tags: ['cooking', 'edibles', 'workshop'],
  },
  {
    id: 'e5',
    title: 'Beach Cleanup & Bonfire',
    description: 'Let\'s give back to our beautiful coast. We\'ll spend an hour cleaning up the beach, then reward ourselves with a sunset bonfire and good vibes. S\'mores included!',
    eventType: EventType.Outdoor,
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '5:00 PM',
    location: 'Public Beach, St. Pete',
    hostId: 'u5',
    attendees: ['u3', 'u1'],
    strainsOnDeck: [
      { id: 's6', userId: 'u5', strainName: 'Green Crack', type: StrainPreference.Sativa },
    ],
    tags: ['outdoors', 'beach', 'chill', 'bonfire'],
  },
  {
    id: 'e6',
    title: 'Vinyl & Vibes Listening Party',
    description: 'Come chill and listen to some deep cuts on a proper sound system. Bring a record to share or just come to listen. All genres welcome, from jazz to electronic.',
    eventType: EventType.Music,
    date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '8:00 PM',
    location: 'Loft Apartment, Miami',
    hostId: 'u8',
    attendees: ['u1', 'u3'],
    strainsOnDeck: [
      { id: 's7', userId: 'u8', strainName: 'Gelato', type: StrainPreference.Hybrid },
      { id: 's8', userId: 'u1', strainName: 'Jack Herer', type: StrainPreference.Sativa },
    ],
    tags: ['music', 'vinyl', 'chill', 'hifi'],
  },
  {
    id: 'e7',
    title: 'Puff, Pass & Paint',
    description: 'No experience needed! Just bring your creativity and your favorite strain. We\'ll have canvases, paints, and brushes ready for a night of artistic expression.',
    eventType: EventType.Creative,
    date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '7:30 PM',
    location: 'Art Studio, Sarasota',
    hostId: 'u6',
    attendees: [],
    strainsOnDeck: [],
    tags: ['art', 'creative', 'painting', 'relax'],
  },
];

const now = Date.now();
export const MESSAGES: Message[] = [
  // Conversation 1: u1 (NeonRyder) & u2 (GlitchWitch)
  { id: 'm1', senderId: 'u1', text: 'Hey, you going to the arcade night?', timestamp: new Date(now - 10 * 60000).toISOString() },
  { id: 'm2', senderId: 'u2', text: 'Definitely! Charging up my controllers now.', timestamp: new Date(now - 9 * 60000).toISOString() },
  { id: 'm3', senderId: 'u1', text: 'Sweet! See you there. Who do you think will win in Mario Kart?', timestamp: new Date(now - 8 * 60000).toISOString() },
  { id: 'm4', senderId: 'u2', text: 'Haha, you know I\'m the queen of Rainbow Road. Bring it on!', timestamp: new Date(now - 7 * 60000).toISOString() },
  { id: 'm5', senderId: 'u1', text: 'We\'ll see about that! I\'ve been practicing.', timestamp: new Date(now - 6 * 60000).toISOString() },

  // Conversation 2: u1 (NeonRyder) & u3 (SynthWaveSurfer)
  { id: 'm6', senderId: 'u3', text: 'Yo, that synth session was fire!', timestamp: new Date(now - 20 * 60000).toISOString() },
  { id: 'm7', senderId: 'u1', text: 'For sure! We gotta jam again soon. Your new track is sick.', timestamp: new Date(now - 19 * 60000).toISOString() },
  { id: 'm8', senderId: 'u3', text: 'Thanks man! I was thinking we could try a collab?', timestamp: new Date(now - 18 * 60000).toISOString() },
  { id: 'm9', senderId: 'u1', text: 'I\'m down! Let\'s link up next week.', timestamp: new Date(now - 17 * 60000).toISOString() },

  // Conversation 3: u4 (CosmicChef) & u2 (GlitchWitch)
  { id: 'm10', senderId: 'u4', text: 'Hey! Saw you RSVP\'d to my edibles workshop. Can\'t wait!', timestamp: new Date(now - 30 * 60000).toISOString() },
  { id: 'm11', senderId: 'u2', text: 'I am so stoked! Always wanted to learn how to make them properly.', timestamp: new Date(now - 29 * 60000).toISOString() },
  { id: 'm12', senderId: 'u4', text: 'Awesome! I\'ll have all the gear. Just bring your creativity.', timestamp: new Date(now - 28 * 60000).toISOString() },
  { id: 'm13', senderId: 'u2', text: 'Perfect! Will there be savory options too?', timestamp: new Date(now - 27 * 60000).toISOString() },
  { id: 'm14', senderId: 'u4', text: 'You know it! I\'m thinking infused mini quiches.', timestamp: new Date(now - 26 * 60000).toISOString() },

  // Conversation 4: u5 (TerraTrekker) & u8 (BeatDropper)
  { id: 'm15', senderId: 'u5', text: 'Saw you\'re in Miami too. The weather is perfect for a beach day.', timestamp: new Date(now - 40 * 60000).toISOString() },
  { id: 'm16', senderId: 'u8', text: 'For real. Was thinking of spinning some tunes at South Pointe Park later.', timestamp: new Date(now - 39 * 60000).toISOString() },
  { id: 'm17', senderId: 'u5', text: 'That sounds like a vibe. I might swing by after a walk.', timestamp: new Date(now - 38 * 60000).toISOString() },
  { id: 'm18', senderId: 'u8', text: 'Cool, I\'ll be the one with the groovy beats and a portable setup.', timestamp: new Date(now - 37 * 60000).toISOString() },

  // Conversation 5: u1 (NeonRyder) & u7 (ByteBard)
  { id: 'm19', senderId: 'u1', text: 'Hey, saw your profile. Your interest in AI and art is fascinating.', timestamp: new Date(now - 50 * 60000).toISOString() },
  { id: 'm20', senderId: 'u7', text: 'Thanks! I\'ve been experimenting with generative art. It\'s wild.', timestamp: new Date(now - 49 * 60000).toISOString() },
  { id: 'm21', senderId: 'u1', text: 'I\'d love to see it sometime! As a creative, I\'m curious about the digital side.', timestamp: new Date(now - 48 * 60000).toISOString() },
  { id: 'm22', senderId: 'u7', text: 'For sure. Maybe we can check out the new digital art exhibit downtown?', timestamp: new Date(now - 47 * 60000).toISOString() },
  { id: 'm23', senderId: 'u1', text: 'That would be amazing! I\'m free this weekend.', timestamp: new Date(now - 46 * 60000).toISOString() },
];

export const CONVERSATIONS: Conversation[] = [
    { id: 'c1', participantIds: ['u1', 'u2'], messages: [MESSAGES[0], MESSAGES[1], MESSAGES[2], MESSAGES[3], MESSAGES[4]] },
    { id: 'c2', participantIds: ['u1', 'u3'], messages: [MESSAGES[5], MESSAGES[6], MESSAGES[7], MESSAGES[8]] },
    { id: 'c3', participantIds: ['u4', 'u2'], messages: [MESSAGES[9], MESSAGES[10], MESSAGES[11], MESSAGES[12], MESSAGES[13]] },
    { id: 'c4', participantIds: ['u5', 'u8'], messages: [MESSAGES[14], MESSAGES[15], MESSAGES[16], MESSAGES[17]] },
    { id: 'c5', participantIds: ['u1', 'u7'], messages: [MESSAGES[18], MESSAGES[19], MESSAGES[20], MESSAGES[21], MESSAGES[22]] },
];

export const NOTIFICATIONS: Notification[] = [];


import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Conversation, Message, User } from '../types';

const Messaging: React.FC = () => {
  const { 
    currentUser, 
    users, 
    conversations, 
    selectedConversation, 
    setSelectedConversation,
  } = useContext(AppContext);

  if (!currentUser) return null;

  const userConversations = conversations
    .filter(c => c.participantIds.includes(currentUser.id))
    .sort((a, b) => {
        const lastMsgA = a.messages[a.messages.length - 1];
        const lastMsgB = b.messages[b.messages.length - 1];
        if (!lastMsgA) return 1;
        if (!lastMsgB) return -1;
        return new Date(lastMsgB.timestamp).getTime() - new Date(lastMsgA.timestamp).getTime();
    });

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <aside className={cn(
        "w-full md:w-1/3 md:flex flex-col border-r-2 border-brand-primary/20",
        selectedConversation ? 'hidden md:flex' : 'flex'
      )}>
        <div className="overflow-y-auto flex-grow p-2">
            {userConversations.map(convo => {
              const otherUserId = convo.participantIds.find(id => id !== currentUser.id);
              const otherUser = users.find(u => u.id === otherUserId);
              if (!otherUser) return null;
              
              const lastMessage = convo.messages[convo.messages.length - 1];

              return (
                <div 
                  key={convo.id}
                  onClick={() => setSelectedConversation(convo.id)}
                  className={cn(
                    "flex items-center p-3 rounded-lg cursor-pointer transition-colors",
                    selectedConversation?.id === convo.id ? 'bg-brand-primary/10' : 'hover:bg-dark-surface'
                  )}
                >
                  <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-12 h-12 rounded-full mr-4 border-2 border-brand-secondary" />
                  <div className="flex-grow overflow-hidden">
                    <h3 className="font-bold text-brand-secondary truncate">{otherUser.name}</h3>
                    <p className="text-sm text-dark-text/70 truncate">
                      {lastMessage ? `${lastMessage.senderId === currentUser.id ? 'You: ' : ''}${lastMessage.text}` : 'No messages yet'}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </aside>

      {/* Chat Window */}
      <main className={cn(
        "w-full md:w-2/3 flex-col",
        selectedConversation ? 'flex' : 'hidden md:flex'
      )}>
        {selectedConversation ? (
          <ChatWindow conversation={selectedConversation} key={selectedConversation.id} />
        ) : (
          <div className="flex-grow flex items-center justify-center text-center p-4">
            <div>
              <h2 className="text-2xl font-bold text-brand-primary">Select a conversation</h2>
              <p className="text-brand-secondary mt-2">Choose a chat from the left to see your messages.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ChatWindow: React.FC<{conversation: Conversation}> = ({ conversation }) => {
    const { currentUser, users, sendMessage } = useContext(AppContext);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const otherUser = users.find(u => u.id === conversation.participantIds.find((id: string) => id !== currentUser?.id));
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom()
    }, [conversation.messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        sendMessage(conversation.id, newMessage);
        setNewMessage('');
    };

    if (!currentUser || !otherUser) return null;

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-grow overflow-y-auto pr-2 space-y-4 p-2">
          {conversation.messages.map((msg: Message) => (
            <div key={msg.id} className={cn("flex items-start gap-3", msg.senderId === currentUser.id ? 'justify-end' : 'justify-start')}>
              {msg.senderId !== currentUser.id && (
                <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-8 h-8 rounded-full"/>
              )}
              <div 
                className={cn(
                  "max-w-md p-3 rounded-xl",
                  msg.senderId === currentUser.id 
                    ? 'bg-brand-primary text-black rounded-br-none'
                    : 'bg-dark-surface text-dark-text rounded-bl-none'
                )}
              >
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
            <Input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a vibe..."
                className="flex-grow"
                autoComplete="off"
            />
            <Button type="submit">Send</Button>
        </form>
      </div>
    )
}

export default Messaging;

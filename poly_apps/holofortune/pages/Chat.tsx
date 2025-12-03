import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MobileLayout, Header, Input } from '../components/Shared';
import { useStore } from '../store';
import { Send } from 'lucide-react';

const Chat: React.FC = () => {
  const { id } = useParams();
  const { friends } = useStore();
  const friend = friends.find(f => f.id === id);
  const [message, setMessage] = useState('');

  if (!friend) return <div>Friend not found</div>;

  return (
    <MobileLayout showNav={false}>
      <Header title={friend.name} backTo="/friends" />
      
      <div className="chat-container">
        <div className="chat-messages">
           <div className="text-center" style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 12 }}>Today 10:45 AM</div>
           
           <div className="message-bubble theirs">
              Hey, are you still at the gym?
           </div>
           
           <div className="message-bubble mine">
              Just leaving now!
           </div>
           
           <div className="message-bubble theirs">
              {friend.chat?.lastMessage || "Okay, stay safe!"}
           </div>
        </div>

        <div className="chat-input-area">
           <Input 
             placeholder="Type a message..." 
             value={message} 
             onChange={e => setMessage(e.target.value)}
             style={{ borderRadius: 24, paddingLeft: 20 }}
           />
           <button style={{ padding: 10, background: 'var(--primary-color)', borderRadius: '50%', color: 'white' }}>
             <Send size={20} />
           </button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Chat;
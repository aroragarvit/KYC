import React, { useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Bot, User, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid'; // For generating thread IDs
import { useGetMessages, useAgentInteraction } from '@/queries/messages';

export interface KycChatProps {
  clientId: string; // ID of the client/individual/company being viewed
}

export const KycChat: React.FC<KycChatProps> = ({ clientId }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [threadId, setThreadId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Query to fetch messages
  const { data: messages, isLoading } = useGetMessages(clientId);
  
  // Mutation to send message and get agent response
  const { mutate: interactWithAgent, isPending: isAgentThinking } = useAgentInteraction();
  
  // Generate a thread ID if we don't have one yet
  useEffect(() => {
    if (!threadId) {
      setThreadId(`thread_${clientId}_${uuidv4()}`);
    }
  }, [clientId, threadId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !threadId) return;
    
    interactWithAgent({
      message: inputMessage,
      clientId,
      threadId,
    });
    
    setInputMessage('');
  };
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="h-5 w-5 mr-2" />
          KYC Assistant Chat
        </CardTitle>
        <CardDescription>Chat with our KYC assistant about this client</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-3">
            {isLoading ? (
              <div className="flex justify-center">Loading messages...</div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg: any ) => (
                <div 
                  key={msg.id} 
                  className={`flex items-start ${msg.message_type === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.message_type === 'agent' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div 
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.message_type === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-muted rounded-tl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <span 
                      className={`text-xs mt-1 block ${
                        msg.message_type === 'user' 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  
                  {msg.message_type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ml-2">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Bot className="h-8 w-8 mb-2" />
                <p>No messages yet. Start a conversation!</p>
              </div>
            )}
            
            {/* Thinking indicator */}
            {isAgentThinking && (
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted p-3 rounded-lg rounded-tl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t pt-4">
            <form className="flex items-center space-x-2" onSubmit={handleSubmit}>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={isAgentThinking}
                />
              </div>
              <Button 
                type="submit" 
                size="icon" 
                disabled={isAgentThinking || !inputMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

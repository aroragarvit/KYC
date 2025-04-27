import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// API URL from Vite environment variables
const API_URL ='http://localhost:3000';

export interface Message {
  id: number;
  client_id: string;
  message: string;
  message_type: 'agent' | 'user';
  created_at: string;
}

// Fetch messages for a specific client
export const useGetMessages = (clientId: string) => {
  return useQuery({
    queryKey: ['messages', clientId],
    queryFn: async () => {
      const response = await axios.get<Message[]>(`${API_URL}/messages?clientId=${clientId}`);
      return response.data;
    },
  });
};

// Send a new message
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newMessage: {
      client_id: string;
      message: string;
      message_type: 'agent' | 'user';
    }) => {
      const response = await axios.post<Message>(`${API_URL}/messages`, newMessage);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch messages for this client immediately
      queryClient.invalidateQueries({ queryKey: ['messages', variables.client_id] });
      // Optionally, you can add immediate data update with setQueryData
      queryClient.setQueryData(['messages', variables.client_id], (oldData: Message[] | undefined) => {
        return oldData ? [...oldData, data] : [data];
      });
    },
  });
};

// API hook to interact with the agent
export const useAgentInteraction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      message,
      clientId,
      threadId,
    }: {
      message: string;
      clientId: string;
      threadId: string;
    }) => {
      // First save the user message to the database
      const userMessageResponse = await axios.post<Message>(`${API_URL}/messages`, {
        client_id: clientId,
        message: message,
        message_type: 'user',
      });
      
      // Immediately invalidate messages to show user message
      queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
      
      // Then get agent response
      const response = await axios.post<{ response: string }>(`${API_URL}/agent-generate`, {
        message,
        clientId,
        threadId,
      });
      
      // Save the agent response to the database
      const agentMessageResponse = await axios.post<Message>(`${API_URL}/messages`, {
        client_id: clientId,
        message: response.data.response,
        message_type: 'agent',
      });
      
      // Invalidate again after agent response is saved
      queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
      
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Final invalidation to ensure everything is up to date
      queryClient.invalidateQueries({ queryKey: ['messages', variables.clientId] });
    },
  });
};
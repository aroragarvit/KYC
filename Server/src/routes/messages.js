/**
 * Messages routes for Fastify
 * 
 * Handles GET and POST requests for messages
 */
async function messagesRoutes(fastify, options) {
    // GET /api/messages - fetch messages for a client
    fastify.get("/messages", async (request, reply) => {
      try {
        const { clientId } = request.query;
        
        if (!clientId) {
          return reply.code(400).send({ error: "Client ID is required" });
        }
        
        const messages = fastify.kycDb
          .prepare(
            `SELECT * FROM messages WHERE client_id = ? ORDER BY created_at ASC`
          )
          .all(clientId);
          
        return reply.send(messages);
      } catch (error) {
        fastify.log.error('Error fetching messages:', error);
        return reply.code(500).send({ error: "Error fetching messages" });
      }
    });
    
    // POST /api/messages - create a new message
    fastify.post("/messages", async (request, reply) => {
      try {
        const { client_id, message, message_type } = request.body;
        
        if (!client_id || !message || !message_type) {
          return reply.code(400).send({ error: "Missing required fields" });
        }
        
        const result = fastify.kycDb
          .prepare(
            `INSERT INTO messages (client_id, message, message_type) VALUES (?, ?, ?) RETURNING *`
          )
          .get(client_id, message, message_type);
          
        return reply.code(201).send(result);
      } catch (error) {
        fastify.log.error('Error creating message:', error);
        return reply.code(500).send({ error: "Error creating message" });
      }
    });

    fastify.post("/agent-generate", async (request, reply) => {
        try {
          const { message, clientId, threadId } = request.body;
          console.log("client id", clientId);
          console.log("thread id", threadId);
          if (!message || !clientId || !threadId) {
            return reply.code(400).send({ error: "Missing required fields" });
          }
          
          // Prepare the request payload for the KYC agent API
          const payload = {
            messages: [{ role: 'user', content: message }],
            clientId: clientId,
            threadId: threadId,
            resourceId: threadId,
            memoryOptions: {
              lastMessages: 10,
              semanticRecall: {
                topK: 3
              },
              workingMemory: {
                enabled: true
              }
            }
          };
          
          // Agent API URL (can be configured in your fastify config)
          const agentApiUrl = 'http://localhost:4111/api/agents/kycAgent/generate';
          
          // Make the API call using fetch
          const response = await fetch(agentApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Agent API error: ${errorData.error || response.statusText}`);
          }
          
          // Parse the response
          const result = await response.json();
          
          // Return the agent's response
          return reply.send({ response: result.text || result.response });
        } catch (error) {
          fastify.log.error('Error generating agent response:', error);
          return reply.code(500).send({ error: "Error generating agent response", error });
        }
      });
  }
  
  module.exports = messagesRoutes;
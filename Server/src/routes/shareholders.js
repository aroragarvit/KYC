async function shareholderRoutes(fastify, options) {
  /**
   * GET /shareholders
   * Retrieve all shareholders
   */

  /**
   * GET /shareholders/:id
   * Retrieve a specific shareholder by ID
   */
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      const shareholder = await fastify.db.get(
        'SELECT * FROM shareholders WHERE id = ?',
        [id]
      );
      
      if (!shareholder) {
        fastify.log.info({ id }, 'Shareholder not found');
        return reply.code(404).send({ error: 'Shareholder not found', id });
      }
      
      fastify.log.info({ id, type: shareholder.shareholder_type }, 'Retrieved shareholder');
      return { shareholder };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/shareholders/${id}`,
        id,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch shareholder');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch shareholder details' });
    }
  });

  /**
   * PATCH /shareholders/:id
   * Update shareholder information
   */
  fastify.patch("/:id", {
    schema: {
      body: {
        type: 'object',
        properties: {
          shareholder_type: { type: 'string', enum: ['Individual', 'Corporate'] },
          origin: { type: 'string' },
          full_name: { type: 'string' },
          id_number: { type: 'string' },
          id_type: { type: 'string' },
          nationality: { type: 'string' },
          residential_address: { type: 'string' },
          company_name: { type: 'string' },
          registration_number: { type: 'string' },
          registered_address: { type: 'string' },
          signatory_name: { type: 'string' },
          signatory_email: { type: 'string' },
          telephone_number: { type: 'string' },
          email_address: { type: 'string' },
          number_of_shares: { type: 'integer' },
          price_per_share: { type: 'number' },
          percentage_ownership: { type: 'number' },
          beneficial_owners: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      try {
        // Check if shareholder exists
        const shareholder = await fastify.db.get(
          'SELECT * FROM shareholders WHERE id = ?',
          [id]
        );
        
        if (!shareholder) {
          fastify.log.info({ id }, 'Shareholder not found during update');
          return reply.code(404).send({ error: 'Shareholder not found', id });
        }
        
        // Build SET clause and parameters for SQL
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(request.body)) {
          if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }
        
        if (fields.length === 0) {
          fastify.log.info({ id }, 'No fields to update for shareholder');
          return reply.code(400).send({ error: 'No fields to update', id });
        }
        
        // Add ID as the last parameter
        values.push(id);
        
        const query = `
          UPDATE shareholders 
          SET ${fields.join(', ')}
          WHERE id = ?
        `;
        
        await fastify.db.run(query, values);
        
        // Fetch updated shareholder
        const updatedShareholder = await fastify.db.get(
          'SELECT * FROM shareholders WHERE id = ?',
          [id]
        );
        
        fastify.log.info({ 
          id, 
          updated_fields: Object.keys(request.body),
          shareholder_type: updatedShareholder.shareholder_type
        }, 'Shareholder updated successfully');
        
        return { shareholder: updatedShareholder };
      } catch (error) {
        fastify.log.error({
          method: 'PATCH',
          path: `/shareholders/${id}`,
          id,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to update shareholder');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to update shareholder' });
      }
    }
  });

  /**
   * PATCH /shareholders/:id/verification
   * Update shareholder verification status
   */
  fastify.patch("/:id/verification", {
    schema: {
      body: {
        type: 'object',
        required: ['verification_Status'],
        properties: {
          verification_Status: { 
            type: 'string', 
            enum: ['verified', 'notverified', 'pending', 'beneficial_ownership_incomplete'] 
          },
          KYC_Status: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      try {
        const { verification_Status, KYC_Status } = request.body;
        
        // Check if shareholder exists
        const shareholder = await fastify.db.get(
          'SELECT * FROM shareholders WHERE id = ?',
          [id]
        );
        
        if (!shareholder) {
          fastify.log.info({ id }, 'Shareholder not found during verification update');
          return reply.code(404).send({ error: 'Shareholder not found', id });
        }
        
        // Update verification status
        await fastify.db.run(
          'UPDATE shareholders SET verification_Status = ?, KYC_Status = ? WHERE id = ?',
          [verification_Status, KYC_Status, id]
        );
        
        // Fetch updated shareholder
        const updatedShareholder = await fastify.db.get(
          'SELECT * FROM shareholders WHERE id = ?',
          [id]
        );
        
        fastify.log.info({ 
          id, 
          previous_status: shareholder.verification_Status,
          new_status: verification_Status,
          shareholder_type: shareholder.shareholder_type
        }, 'Shareholder verification status updated');
        
        return { shareholder: updatedShareholder };
      } catch (error) {
        fastify.log.error({
          method: 'PATCH',
          path: `/shareholders/${id}/verification`,
          id,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to update shareholder verification status');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to update shareholder verification status' });
      }
    }
  });

  /**
   * DELETE /shareholders/:id
   * Delete a shareholder
   */
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      // Check if shareholder exists
      const shareholder = await fastify.db.get(
        'SELECT * FROM shareholders WHERE id = ?',
        [id]
      );
      
      if (!shareholder) {
        fastify.log.info({ id }, 'Shareholder not found during deletion');
        return reply.code(404).send({ error: 'Shareholder not found', id });
      }
      
      // Delete shareholder
      await fastify.db.run(
        'DELETE FROM shareholders WHERE id = ?',
        [id]
      );
      
      fastify.log.info({ 
        id, 
        company_id: shareholder.company_id,
        shareholder_type: shareholder.shareholder_type,
        name: shareholder.full_name || shareholder.company_name || 'Unknown'
      }, 'Shareholder deleted successfully');
      
      return { 
        message: 'Shareholder deleted successfully',
        id,
        company_id: shareholder.company_id
      };
    } catch (error) {
      fastify.log.error({
        method: 'DELETE',
        path: `/shareholders/${id}`,
        id,
        error: error.message,
        stack: error.stack,
      }, 'Failed to delete shareholder');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to delete shareholder' });
    }
  });
}

module.exports = shareholderRoutes; 
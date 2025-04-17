async function companyRoutes(fastify, options) {
  /**
   * GET /companies 
   * List all companies
   */
  fastify.get("/", async (request, reply) => {
    try {
      const companies = await fastify.db.all('SELECT * FROM companies ORDER BY name');
      fastify.log.info({ count: companies.length }, 'Retrieved all companies');
      return { companies };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: '/companies',
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch companies');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch companies' });
    }
  });

  /**
   * GET /companies/:name
   * Get a specific company by name
   */
  fastify.get("/:name", async (request, reply) => {
    const { name } = request.params;
    try {
      const company = await fastify.db.get(
        'SELECT * FROM companies WHERE name = ?',
        [name]
      );

      if (!company) {
        fastify.log.info({ name }, 'Company not found');
        return reply.code(404).send({ error: 'Company not found', name });
      }

      return { company };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/companies/${name}`,
        name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch company');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch company details' });
    }
  });

  /**
   * GET /companies/:name/documents
   * Get all documents for a company
   */
  fastify.get("/:name/documents", async (request, reply) => {
    const { name } = request.params;
    try {
      const company = await fastify.db.get(
        'SELECT * FROM companies WHERE name = ?',
        [name]
      );

      if (!company) {
        fastify.log.info({ name }, 'Company not found when fetching documents');
        return reply.code(404).send({ error: 'Company not found', name });
      }

      const documents = await fastify.db.all(`
        SELECT d.* 
        FROM documents d
        JOIN company_documents cd ON d.id = cd.document_id
        WHERE cd.company_id = ?
        ORDER BY d.name
      `, [company.id]);

      fastify.log.info({ company: name, count: documents.length }, 'Retrieved company documents');
      return { company: company.name, documents };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/companies/${name}/documents`,
        name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch company documents');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch company documents' });
    }
  });

  /**
   * GET /companies/:name/shareholders
   * Retrieve all shareholders for a specific company
   */
  fastify.get("/:name/shareholders", async (request, reply) => {
    const { name } = request.params;
    try {
      // First, get the company ID
      const company = await fastify.db.get(
        'SELECT * FROM companies WHERE name = ?',
        [name]
      );
      
      if (!company) {
        fastify.log.info({ name }, 'Company not found when fetching shareholders');
        return reply.code(404).send({ error: 'Company not found', name });
      }
      
      // Get all shareholders for the company
      const shareholders = await fastify.db.all(
        'SELECT * FROM shareholders WHERE company_id = ? ORDER BY id',
        [company.id]
      );
      
      fastify.log.info({ 
        name, 
        company_id: company.id, 
        count: shareholders.length 
      }, 'Retrieved shareholders for company');
      
      return { company: company.name, shareholders };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/companies/${name}/shareholders`,
        name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch company shareholders');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch company shareholders' });
    }
  });

  /**
   * POST /companies/:name/shareholders
   * Add a new shareholder to a company
   */
  fastify.post("/:name/shareholders", {
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
      const { name } = request.params;
      try {
        // Get company ID or create if it doesn't exist
        let company = await fastify.db.get(
          'SELECT * FROM companies WHERE name = ?',
          [name]
        );
        
        let companyId;
        if (!company) {
          // Create the company
          fastify.log.info({ name }, 'Creating new company during shareholder creation');
          const result = await fastify.db.run(
            'INSERT INTO companies (name) VALUES (?)',
            [name]
          );
          companyId = result.lastID;
        } else {
          companyId = company.id;
        }
        
        // Build INSERT query
        const fields = ['company_id'];
        const placeholders = ['?'];
        const values = [companyId];
        
        for (const [key, value] of Object.entries(request.body)) {
          if (value !== undefined) {
            fields.push(key);
            placeholders.push('?');
            values.push(value);
          }
        }
        
        const query = `
          INSERT INTO shareholders (${fields.join(', ')})
          VALUES (${placeholders.join(', ')})
        `;
        
        const result = await fastify.db.run(query, values);
        
        // Fetch the created shareholder
        const shareholder = await fastify.db.get(
          'SELECT * FROM shareholders WHERE id = ?',
          [result.lastID]
        );
        
        fastify.log.info({ 
          company_name: name,
          company_id: companyId,
          shareholder_id: result.lastID,
          shareholder_type: request.body.shareholder_type || 'Unknown'
        }, 'Created new shareholder');
        
        return reply.code(201).send({ shareholder });
      } catch (error) {
        fastify.log.error({
          method: 'POST',
          path: `/companies/${name}/shareholders`,
          name,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to create shareholder');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to create shareholder' });
      }
    }
  });

  /**
   * DELETE /companies/:name/shareholders
   * Delete all shareholders for a company
   */
  fastify.delete("/:name/shareholders", async (request, reply) => {
    const { name } = request.params;
    try {
      // First, get the company ID
      const company = await fastify.db.get(
        'SELECT * FROM companies WHERE name = ?',
        [name]
      );
      
      if (!company) {
        fastify.log.info({ name }, 'Company not found when deleting shareholders');
        return reply.code(404).send({ error: 'Company not found', name });
      }
      
      // Count shareholders before deletion
      const countResult = await fastify.db.get(
        'SELECT COUNT(*) as count FROM shareholders WHERE company_id = ?',
        [company.id]
      );
      
      // Delete all shareholders for the company
      await fastify.db.run(
        'DELETE FROM shareholders WHERE company_id = ?',
        [company.id]
      );
      
      fastify.log.info({ 
        company_name: name,
        company_id: company.id,
        deleted_count: countResult.count
      }, 'Deleted all shareholders for company');
      
      return { 
        message: `Successfully deleted ${countResult.count} shareholders for company ${name}`,
        count: countResult.count
      };
    } catch (error) {
      fastify.log.error({
        method: 'DELETE',
        path: `/companies/${name}/shareholders`,
        name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to delete shareholders');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to delete shareholders' });
    }
  });
}

module.exports = companyRoutes; 
import { register, login } from './auth.js';
import { getWallets, handlePostTask, handleSubmitProof } from './marketplace.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
      // Health check
      if (path === '/api/health') {
        return new Response(JSON.stringify({ status: 'Aurevo API is operational' }), { headers: cors });
      }

      // Auth routes
      if (path === '/api/register' && method === 'POST') {
        return await register(req, env, cors);
      }
      if (path === '/api/login' && method === 'POST') {
        return await login(req, env, cors);
      }

      // Wallet balance route
      if (path === '/api/wallets' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: cors });
        }
        const balances = await getWallets(userId, env);
        return new Response(JSON.stringify(balances), { headers: cors });
      }

      // Task Marketplace routes
      if (path === '/api/tasks/post' && method === 'POST') {
        return await handlePostTask(req, env, cors);
      }
      if (path === '/api/tasks/submit-proof' && method === 'POST') {
        return await handleSubmitProof(req, env, cors);
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
  }
};

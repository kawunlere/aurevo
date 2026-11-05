import { register, login } from './auth.js';
import { getWallets, handleGetTasks, handlePostTask, handleSubmitProof, handleTopup, handleWithdraw } from './marketplace.js';
import { handleAdminStats, handleGetPendingProofs, handleActionProof, handleGetPendingWithdrawals, handleActionWithdrawal } from './admin.js';
import { handleGetPlans, handleSubscribePlan } from './plans.js';

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
      if (path === '/api/health') {
        return new Response(JSON.stringify({ status: 'Aurevo API operational' }), { headers: cors });
      }
      if (path === '/api/register' && method === 'POST') {
        return await register(req, env, cors);
      }
      if (path === '/api/login' && method === 'POST') {
        return await login(req, env, cors);
      }
      if (path === '/api/wallets' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: cors });
        }
        const balances = await getWallets(userId, env);
        return new Response(JSON.stringify(balances), { headers: cors });
      }
      if (path === '/api/tasks' && method === 'GET') {
        return await handleGetTasks(req, env, cors);
      }
      if (path === '/api/tasks/post' && method === 'POST') {
        return await handlePostTask(req, env, cors);
      }
      if (path === '/api/tasks/submit-proof' && method === 'POST') {
        return await handleSubmitProof(req, env, cors);
      }
      if (path === '/api/topup' && method === 'POST') {
        return await handleTopup(req, env, cors);
      }
      if (path === '/api/withdraw' && method === 'POST') {
        return await handleWithdraw(req, env, cors);
      }

      // Plans routes
      if (path === '/api/plans' && method === 'GET') {
        return await handleGetPlans(req, env, cors);
      }
      if (path === '/api/subscribe' && method === 'POST') {
        return await handleSubscribePlan(req, env, cors);
      }

      // Admin routes
      if (path === '/api/admin/stats' && method === 'GET') {
        return await handleAdminStats(req, env, cors);
      }
      if (path === '/api/admin/proofs' && method === 'GET') {
        return await handleGetPendingProofs(req, env, cors);
      }
      if (path === '/api/admin/proofs/action' && method === 'POST') {
        return await handleActionProof(req, env, cors);
      }
      if (path === '/api/admin/withdrawals' && method === 'GET') {
        return await handleGetPendingWithdrawals(req, env, cors);
      }
      if (path === '/api/admin/withdrawals/action' && method === 'POST') {
        return await handleActionWithdrawal(req, env, cors);
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
  }
};

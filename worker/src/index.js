import { register, login } from './auth.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {headers: cors});
    const path = new URL(req.url).pathname;

    if (path === '/api/health') {
      return new Response(JSON.stringify({status:'Aurevo is live'}), {headers: cors});
    }
    if (path === '/api/register' && req.method === 'POST') {
      return await register(req, env, cors);
    }
    if (path === '/api/login' && req.method === 'POST') {
      return await login(req, env, cors);
    }

    return new Response(JSON.stringify({error:'Not found'}), {status:404, headers: cors});
  }
};

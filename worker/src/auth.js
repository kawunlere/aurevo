const SECRET = 'aurevo_2024_secret_key';

async function hash(pw) {
  const data = new TextEncoder().encode(pw + SECRET);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function makeToken(id, role) {
  const h = btoa(JSON.stringify({alg:'HS256'}));
  const p = btoa(JSON.stringify({id, role, exp: Date.now() + 604800000}));
  return h + '.' + p + '.' + btoa(SECRET);
}

export async function register(req, env, h) {
  const {name, email, phone, country, password} = await req.json();
  if (!name || !email || !password) {
    return new Response(JSON.stringify({error:'Name, email, password required'}), {status:400, headers:h});
  }
  const exists = await env.AUREVO.get('user:'+email);
  if (exists) {
    return new Response(JSON.stringify({error:'Email taken'}), {status:400, headers:h});
  }
  const id = crypto.randomUUID();
  const user = {
    id, name, email,
    phone: phone || '',
    country: country || 'Nigeria',
    pw: await hash(password),
    plan: 'free',
    role: email === 'kawunlere@gmail.com' ? 'admin' : 'user',
    balance: 0,
    status: 'active',
    created: new Date().toISOString()
  };
  await env.AUREVO.put('user:'+email, JSON.stringify(user));
  const token = makeToken(id, user.role);
  return new Response(JSON.stringify({ok:true, token, user:{id,name,email,plan:user.plan,role:user.role}}), {status:201, headers:h});
}

export async function login(req, env, h) {
  const {email, password} = await req.json();
  if (!email || !password) {
    return new Response(JSON.stringify({error:'Email and password required'}), {status:400, headers:h});
  }
  const raw = await env.AUREVO.get('user:'+email);
  if (!raw) {
    return new Response(JSON.stringify({error:'Invalid login'}), {status:401, headers:h});
  }
  const user = JSON.parse(raw);
  if (user.pw !== await hash(password)) {
    return new Response(JSON.stringify({error:'Invalid login'}), {status:401, headers:h});
  }
  if (user.status !== 'active') {
    return new Response(JSON.stringify({error:'Account suspended'}), {status:403, headers:h});
  }
  const token = makeToken(user.id, user.role);
  return new Response(JSON.stringify({ok:true, token, user:{id:user.id,name:user.name,email,plan:user.plan,role:user.role,balance:user.balance}}), {headers:h});
}

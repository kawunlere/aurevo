const PLANS = [
  { id: 'free', name: 'Free Tier', price: 0, taskLimit: '5 tasks/day', commissionRate: '100%', savingsAccess: false },
  { id: 'basic', name: 'Basic Plan', price: 2000, taskLimit: '15 tasks/day', commissionRate: '110%', savingsAccess: true },
  { id: 'pro', name: 'Pro Plan', price: 5000, taskLimit: '35 tasks/day', commissionRate: '125%', savingsAccess: true },
  { id: 'elite', name: 'Elite Plan', price: 10000, taskLimit: 'Unlimited', commissionRate: '150%', savingsAccess: true }
];

export async function handleGetPlans(request, env, headers) {
  return new Response(JSON.stringify(PLANS), { headers });
}

export async function handleSubscribePlan(request, env, headers) {
  try {
    const { userId, planId } = await request.json();
    const selectedPlan = PLANS.find(p => p.id === planId);

    if (!selectedPlan) {
      return new Response(JSON.stringify({ error: 'Invalid plan selected' }), { status: 400, headers });
    }

    if (selectedPlan.price > 0) {
      const earnings = parseFloat(await env.AUREVO.get(`wallet:earnings:${userId}`) || "0");
      if (earnings < selectedPlan.price) {
        return new Response(JSON.stringify({ error: `Insufficient earnings. Plan requires ₦${selectedPlan.price.toLocaleString()}` }), { status: 400, headers });
      }

      // Deduct plan cost from earnings
      await env.AUREVO.put(`wallet:earnings:${userId}`, (earnings - selectedPlan.price).toString());

      // Deposit 50% into user's Savings Wallet
      const savings = parseFloat(await env.AUREVO.get(`wallet:savings:${userId}`) || "0");
      await env.AUREVO.put(`wallet:savings:${userId}`, (savings + (selectedPlan.price * 0.5)).toString());
    }

    // Save active user subscription
    await env.AUREVO.put(`plan:${userId}`, JSON.stringify({
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      subscribedAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ success: true, message: `Successfully upgraded to ${selectedPlan.name}` }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

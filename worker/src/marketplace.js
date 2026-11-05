// Get user wallet balances
export async function getWallets(userId, env) {
  const credit = await env.AUREVO.get(`wallet:credit:${userId}`) || "0";
  const earnings = await env.AUREVO.get(`wallet:earnings:${userId}`) || "0";
  const savings = await env.AUREVO.get(`wallet:savings:${userId}`) || "0";

  return {
    credit: parseFloat(credit),
    earnings: parseFloat(earnings),
    savings: parseFloat(savings)
  };
}

// Get active tasks for marketplace
export async function handleGetTasks(request, env, headers) {
  try {
    const list = await env.AUREVO.list({ prefix: 'task:' });
    const tasks = [];

    for (const key of list.keys) {
      const raw = await env.AUREVO.get(key.name);
      if (raw) {
        const t = JSON.parse(raw);
        if (t.status === 'active' || t.status === 'approved') {
          tasks.push(t);
        }
      }
    }

    return new Response(JSON.stringify(tasks), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Post a new micro-task
export async function handlePostTask(request, env, headers) {
  try {
    const body = await request.json();
    const { userId, title, category, rewardPerWorker, totalWorkers, requiresProof, isAdmin } = body;

    if (!userId || !title || !rewardPerWorker || !totalWorkers) {
      return new Response(JSON.stringify({ error: 'Missing required task fields' }), { status: 400, headers });
    }

    // If Admin is posting, bypass credit deduction
    if (!isAdmin) {
      const baseCost = rewardPerWorker * totalWorkers;
      const proofFee = requiresProof ? (totalWorkers * 5) : 0;
      const totalCost = baseCost + proofFee + (baseCost * 0.20);

      const wallets = await getWallets(userId, env);
      if (wallets.credit < totalCost) {
        return new Response(JSON.stringify({ error: `Insufficient credit. Total cost is ₦${totalCost}` }), { status: 400, headers });
      }

      // Deduct credit for regular users
      const newCredit = wallets.credit - totalCost;
      await env.AUREVO.put(`wallet:credit:${userId}`, newCredit.toString());
    }

    // Create and publish task
    const taskId = crypto.randomUUID();
    const task = {
      id: taskId,
      posterId: userId,
      title,
      category: category || 'General',
      rewardPerWorker,
      totalWorkers,
      completedWorkers: 0,
      requiresProof: !!requiresProof,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await env.AUREVO.put(`task:${taskId}`, JSON.stringify(task));

    return new Response(JSON.stringify({ success: true, taskId, message: 'Task published to marketplace' }), { status: 201, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Submit proof of completed task
export async function handleSubmitProof(request, env, headers) {
  try {
    const body = await request.json();
    const { taskId, workerId, proofText, proofLink } = body;

    if (!taskId || !workerId) {
      return new Response(JSON.stringify({ error: 'Missing task or worker ID' }), { status: 400, headers });
    }

    const proofId = crypto.randomUUID();
    const proof = {
      id: proofId,
      taskId,
      workerId,
      proofText: proofText || '',
      proofLink: proofLink || '',
      status: 'pending_review',
      submittedAt: new Date().toISOString()
    };

    await env.AUREVO.put(`proof:${proofId}`, JSON.stringify(proof));

    return new Response(JSON.stringify({ success: true, message: 'Proof submitted successfully' }), { status: 201, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

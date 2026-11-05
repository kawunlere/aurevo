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
        // Display tasks marked active or approved
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
    const { userId, title, category, rewardPerWorker, totalWorkers, requiresProof } = body;

    if (!userId || !title || !rewardPerWorker || !totalWorkers) {
      return new Response(JSON.stringify({ error: 'Missing required task fields' }), { status: 400, headers });
    }

    // Calculate total cost (reward * workers + 20% platform commission)
    const baseCost = rewardPerWorker * totalWorkers;
    const proofFee = requiresProof ? (totalWorkers * 5) : 0;
    const totalCost = baseCost + proofFee + (baseCost * 0.20);

    // Check user credit wallet
    const wallets = await getWallets(userId, env);
    if (wallets.credit < totalCost) {
      return new Response(JSON.stringify({ error: `Insufficient credit. Total cost is ₦${totalCost}` }), { status: 400, headers });
    }

    // Deduct credit
    const newCredit = wallets.credit - totalCost;
    await env.AUREVO.put(`wallet:credit:${userId}`, newCredit.toString());

    // Create task object (Auto-activate for immediate marketplace test)
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

// Handle Credit Wallet Top-up
export async function handleTopup(request, env, headers) {
  try {
    const body = await request.json();
    const { userId, amount, reference } = body;

    if (!userId || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Valid User ID and amount required' }), { status: 400, headers });
    }

    const currentCredit = parseFloat(await env.AUREVO.get(`wallet:credit:${userId}`) || "0");
    const newCredit = currentCredit + parseFloat(amount);

    await env.AUREVO.put(`wallet:credit:${userId}`, newCredit.toString());

    // Record transaction
    const txId = crypto.randomUUID();
    const tx = {
      id: txId,
      userId,
      type: 'topup',
      amount: parseFloat(amount),
      reference: reference || 'direct_topup',
      status: 'completed',
      timestamp: new Date().toISOString()
    };
    await env.AUREVO.put(`tx:${txId}`, JSON.stringify(tx));

    return new Response(JSON.stringify({ success: true, newCredit, message: 'Credit wallet funded successfully' }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Handle Earnings Withdrawal Request
export async function handleWithdraw(request, env, headers) {
  try {
    const body = await request.json();
    const { userId, amount, bankName, accountNumber, accountName } = body;

    if (!userId || !amount || !bankName || !accountNumber || !accountName) {
      return new Response(JSON.stringify({ error: 'All withdrawal details required' }), { status: 400, headers });
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount < 1000) {
      return new Response(JSON.stringify({ error: 'Minimum withdrawal amount is ₦1,000' }), { status: 400, headers });
    }

    const earnings = parseFloat(await env.AUREVO.get(`wallet:earnings:${userId}`) || "0");
    if (earnings < withdrawAmount) {
      return new Response(JSON.stringify({ error: 'Insufficient earnings balance' }), { status: 400, headers });
    }

    // Deduct from earnings wallet
    const newEarnings = earnings - withdrawAmount;
    await env.AUREVO.put(`wallet:earnings:${userId}`, newEarnings.toString());

    // Record pending withdrawal request for admin approval
    const withdrawalId = crypto.randomUUID();
    const requestData = {
      id: withdrawalId,
      userId,
      amount: withdrawAmount,
      bankName,
      accountNumber,
      accountName,
      status: 'pending_payout',
      requestedAt: new Date().toISOString()
    };

    await env.AUREVO.put(`withdrawal:${withdrawalId}`, JSON.stringify(requestData));

    return new Response(JSON.stringify({ success: true, message: 'Withdrawal request submitted' }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

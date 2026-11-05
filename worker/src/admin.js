// Fetch Platform Admin Stats
export async function handleAdminStats(request, env, headers) {
  try {
    const usersList = await env.AUREVO.list({ prefix: 'user:' });
    const withdrawalList = await env.AUREVO.list({ prefix: 'withdrawal:' });
    const proofList = await env.AUREVO.list({ prefix: 'proof:' });

    let pendingWithdrawalCount = 0;
    let pendingProofCount = 0;

    for (const key of withdrawalList.keys) {
      const w = JSON.parse(await env.AUREVO.get(key.name) || '{}');
      if (w.status === 'pending_payout') pendingWithdrawalCount++;
    }

    for (const key of proofList.keys) {
      const p = JSON.parse(await env.AUREVO.get(key.name) || '{}');
      if (p.status === 'pending_review') pendingProofCount++;
    }

    return new Response(JSON.stringify({
      totalUsers: usersList.keys.length,
      pendingWithdrawals: pendingWithdrawalCount,
      pendingProofs: pendingProofCount
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Fetch Pending Task Proofs
export async function handleGetPendingProofs(request, env, headers) {
  try {
    const proofList = await env.AUREVO.list({ prefix: 'proof:' });
    const pendingProofs = [];

    for (const key of proofList.keys) {
      const proof = JSON.parse(await env.AUREVO.get(key.name) || '{}');
      if (proof.status === 'pending_review') {
        const taskRaw = await env.AUREVO.get(`task:${proof.taskId}`);
        proof.task = taskRaw ? JSON.parse(taskRaw) : null;
        pendingProofs.push(proof);
      }
    }

    return new Response(JSON.stringify(pendingProofs), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Approve or Reject Proof
export async function handleActionProof(request, env, headers) {
  try {
    const { proofId, action } = await request.json(); // action = 'approve' or 'reject'
    const proofRaw = await env.AUREVO.get(`proof:${proofId}`);
    if (!proofRaw) return new Response(JSON.stringify({ error: 'Proof not found' }), { status: 404, headers });

    const proof = JSON.parse(proofRaw);
    if (action === 'approve') {
      const taskRaw = await env.AUREVO.get(`task:${proof.taskId}`);
      if (taskRaw) {
        const task = JSON.parse(taskRaw);
        const reward = parseFloat(task.rewardPerWorker || 0);

        // Add payout to worker's Earnings Wallet
        const currentEarnings = parseFloat(await env.AUREVO.get(`wallet:earnings:${proof.workerId}`) || "0");
        await env.AUREVO.put(`wallet:earnings:${proof.workerId}`, (currentEarnings + reward).toString());

        // Update task completion count
        task.completedWorkers = (task.completedWorkers || 0) + 1;
        await env.AUREVO.put(`task:${proof.taskId}`, JSON.stringify(task));
      }
      proof.status = 'approved';
    } else {
      proof.status = 'rejected';
    }

    await env.AUREVO.put(`proof:${proofId}`, JSON.stringify(proof));
    return new Response(JSON.stringify({ success: true, status: proof.status }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Fetch Pending Withdrawals
export async function handleGetPendingWithdrawals(request, env, headers) {
  try {
    const list = await env.AUREVO.list({ prefix: 'withdrawal:' });
    const pending = [];

    for (const key of list.keys) {
      const item = JSON.parse(await env.AUREVO.get(key.name) || '{}');
      if (item.status === 'pending_payout') {
        pending.push(item);
      }
    }

    return new Response(JSON.stringify(pending), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Approve or Reject Withdrawal
export async function handleActionWithdrawal(request, env, headers) {
  try {
    const { withdrawalId, action } = await request.json(); // action = 'paid' or 'reject'
    const raw = await env.AUREVO.get(`withdrawal:${withdrawalId}`);
    if (!raw) return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404, headers });

    const item = JSON.parse(raw);
    if (action === 'paid') {
      item.status = 'completed';
    } else {
      item.status = 'rejected';
      // Refund user earnings balance
      const currentEarnings = parseFloat(await env.AUREVO.get(`wallet:earnings:${item.userId}`) || "0");
      await env.AUREVO.put(`wallet:earnings:${item.userId}`, (currentEarnings + item.amount).toString());
    }

    await env.AUREVO.put(`withdrawal:${withdrawalId}`, JSON.stringify(item));
    return new Response(JSON.stringify({ success: true, status: item.status }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

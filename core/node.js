(function initNodeModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizePriority(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(10, Math.round(numeric)));
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function createNode(input) {
    const now = new Date().toISOString();
    const source = input && typeof input === 'object' ? input : {};

    return {
      id: source.id || generateNodeId(),
      text: String(source.text || '').trim() || 'New idea',
      x: Number.isFinite(source.x) ? source.x : 0,
      y: Number.isFinite(source.y) ? source.y : 0,
      notes: String(source.notes || ''),
      tags: normalizeTags(source.tags),
      priority: normalizePriority(source.priority),
      colorOverride: typeof source.colorOverride === 'string' ? source.colorOverride : null,
      dueDate: typeof source.dueDate === 'string' ? source.dueDate : null,
      metadata: source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {},
      aiSummary: typeof source.aiSummary === 'string' ? source.aiSummary : '',
      voiceNote: typeof source.voiceNote === 'string' ? source.voiceNote : '',
      createdAt: source.createdAt || now,
      updatedAt: source.updatedAt || now
    };
  }

  function updateNode(node, patch) {
    if (!node || !patch || typeof patch !== 'object') return node;
    const next = { ...node, ...patch };
    next.tags = normalizeTags(next.tags);
    next.priority = normalizePriority(next.priority);
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function markNodeMoved(node, x, y) {
    return updateNode(node, {
      x: Number.isFinite(x) ? x : node.x,
      y: Number.isFinite(y) ? y : node.y
    });
  }

  root.node = {
    createNode,
    updateNode,
    markNodeMoved
  };
})(window);

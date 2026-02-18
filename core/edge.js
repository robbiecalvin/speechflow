(function initEdgeModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const ALLOWED_EDGE_TYPES = ['dependency', 'sequence', 'reference', 'causal'];

  function generateEdgeId() {
    return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeEdgeType(type) {
    return ALLOWED_EDGE_TYPES.includes(type) ? type : 'sequence';
  }

  function normalizeWeight(weight) {
    const numeric = Number(weight);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(0, Math.min(10, numeric));
  }

  function validateEdgePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Edge payload must be an object.');
    }
    if (!payload.from) {
      throw new Error('Edge requires a from node.');
    }
    if (!payload.to) {
      throw new Error('Edge requires a to node.');
    }
  }

  function createEdge(payload) {
    validateEdgePayload(payload);
    return {
      id: payload.id || generateEdgeId(),
      from: payload.from,
      to: payload.to,
      label: typeof payload.label === 'string' ? payload.label : '',
      weight: normalizeWeight(payload.weight),
      type: normalizeEdgeType(payload.type),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? { ...payload.metadata } : {}
    };
  }

  function edgeExists(edges, fromId, toId, type) {
    if (!Array.isArray(edges)) return false;
    return edges.some((edge) => {
      const edgeFromId = edge.from?.id || edge.from;
      const edgeToId = edge.to?.id || edge.to;
      const edgeType = edge.type || 'sequence';
      return edgeFromId === fromId && edgeToId === toId && edgeType === normalizeEdgeType(type || edgeType);
    });
  }

  root.edge = {
    ALLOWED_EDGE_TYPES,
    createEdge,
    edgeExists,
    normalizeEdgeType,
    normalizeWeight
  };
})(window);

(function initPlaybackModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function sortByPriority(nodes) {
    return [...nodes].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  function getNodeById(nodes) {
    const map = new Map();
    (nodes || []).forEach((node) => map.set(node.id, node));
    return map;
  }

  function generatePlayback(mode, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    const edges = Array.isArray(opts.edges) ? opts.edges : [];
    const graph = root.graph;

    if (!nodes.length) return [];

    if (mode === 'linear') return [...nodes];

    if (mode === 'branch') {
      const startNodeId = opts.startNodeId || nodes[0].id;
      const descendants = graph ? graph.getDescendants(startNodeId, nodes, edges) : [];
      const nodeById = getNodeById(nodes);
      return [startNodeId, ...descendants].map((id) => nodeById.get(id)).filter(Boolean);
    }

    if (mode === 'root-based') {
      const roots = graph ? graph.getRoots(nodes, edges) : [];
      const nodeById = getNodeById(nodes);
      return roots.map((id) => nodeById.get(id)).filter(Boolean);
    }

    if (mode === 'dependency-path') {
      const targetNodeId = opts.targetNodeId || nodes[0].id;
      const path = graph ? graph.getDependencyPath(targetNodeId, nodes, edges) : [targetNodeId];
      const nodeById = getNodeById(nodes);
      return path.map((id) => nodeById.get(id)).filter(Boolean);
    }

    if (mode === 'type-filter') {
      return nodes.filter((node) => !opts.type || node.type === opts.type);
    }

    if (mode === 'loop') {
      const sequence = [...nodes];
      const loops = Number.isFinite(opts.loops) ? Math.max(1, Math.floor(opts.loops)) : 2;
      const result = [];
      for (let i = 0; i < loops; i += 1) {
        result.push(...sequence);
      }
      return result;
    }

    if (mode === 'weighted') {
      const minPriority = Number.isFinite(opts.minPriority) ? opts.minPriority : null;
      const tag = typeof opts.tag === 'string' ? opts.tag : null;
      let filtered = nodes;
      if (minPriority !== null) filtered = filtered.filter((node) => (node.priority || 0) >= minPriority);
      if (tag) filtered = filtered.filter((node) => Array.isArray(node.tags) && node.tags.includes(tag));
      return sortByPriority(filtered);
    }

    return [...nodes];
  }

  root.playback = {
    generatePlayback
  };
})(window);

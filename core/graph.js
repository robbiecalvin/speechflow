(function initGraphModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function getNodeId(node) {
    return typeof node === 'string' ? node : node?.id;
  }

  function buildAdjacency(nodes, edges) {
    const nodeMap = new Map((nodes || []).map((node) => [node.id, node]));
    const outgoing = new Map();
    const incoming = new Map();

    nodeMap.forEach((_, nodeId) => {
      outgoing.set(nodeId, []);
      incoming.set(nodeId, []);
    });

    (edges || []).forEach((edge) => {
      const fromId = getNodeId(edge.from);
      const toId = getNodeId(edge.to);
      if (!nodeMap.has(fromId) || !nodeMap.has(toId)) return;
      outgoing.get(fromId).push({ ...edge, fromId, toId });
      incoming.get(toId).push({ ...edge, fromId, toId });
    });

    return { nodeMap, outgoing, incoming };
  }

  function walk(startId, neighborMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
      const current = queue.shift();
      const neighbors = neighborMap.get(current) || [];
      neighbors.forEach((edge) => {
        const nextId = edge.toId || edge.fromId;
        if (!visited.has(nextId) && nextId !== startId) {
          visited.add(nextId);
          queue.push(nextId);
        }
      });
    }
    return visited;
  }

  function getAncestors(nodeId, nodes, edges) {
    const { incoming } = buildAdjacency(nodes, edges);
    const reversed = new Map();
    incoming.forEach((incomingEdges, id) => {
      reversed.set(
        id,
        incomingEdges.map((edge) => ({ ...edge, toId: edge.fromId }))
      );
    });
    return Array.from(walk(nodeId, reversed));
  }

  function getDescendants(nodeId, nodes, edges) {
    const { outgoing } = buildAdjacency(nodes, edges);
    return Array.from(walk(nodeId, outgoing));
  }

  function getDependencyPath(nodeId, nodes, edges) {
    const { incoming } = buildAdjacency(nodes, edges);
    const path = [];
    let cursor = nodeId;
    const seen = new Set();

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const deps = (incoming.get(cursor) || []).filter((edge) => edge.type === 'dependency');
      if (!deps.length) break;
      const next = deps[0].fromId;
      path.unshift(next);
      cursor = next;
    }

    path.push(nodeId);
    return path;
  }

  function getBranchFromRoot(rootId, nodes, edges) {
    const descendants = getDescendants(rootId, nodes, edges);
    return [rootId, ...descendants];
  }

  function getConnectedComponent(nodeId, nodes, edges) {
    const { outgoing, incoming } = buildAdjacency(nodes, edges);
    const neighbors = new Map();

    outgoing.forEach((value, key) => {
      neighbors.set(key, []);
      value.forEach((edge) => neighbors.get(key).push(edge.toId));
    });

    incoming.forEach((value, key) => {
      if (!neighbors.has(key)) neighbors.set(key, []);
      value.forEach((edge) => neighbors.get(key).push(edge.fromId));
    });

    const visited = new Set([nodeId]);
    const queue = [nodeId];
    while (queue.length) {
      const current = queue.shift();
      (neighbors.get(current) || []).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    return Array.from(visited);
  }

  function detectCycles(nodes, edges) {
    const { outgoing } = buildAdjacency(nodes, edges);
    const visiting = new Set();
    const visited = new Set();

    function dfs(nodeId) {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visiting.add(nodeId);
      const hasCycle = (outgoing.get(nodeId) || []).some((edge) => dfs(edge.toId));
      visiting.delete(nodeId);
      visited.add(nodeId);
      return hasCycle;
    }

    return (nodes || []).some((node) => dfs(node.id));
  }

  function getRoots(nodes, edges) {
    const { incoming } = buildAdjacency(nodes, edges);
    return (nodes || []).filter((node) => (incoming.get(node.id) || []).length === 0).map((node) => node.id);
  }

  function validateGraph(nodes, edges, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const { nodeMap, incoming } = buildAdjacency(nodes, edges);

    const orphanNodes = (nodes || []).filter((node) => {
      const hasIncoming = (incoming.get(node.id) || []).length > 0;
      const hasOutgoing = (edges || []).some((edge) => getNodeId(edge.from) === node.id);
      return !hasIncoming && !hasOutgoing;
    }).map((node) => node.id);

    const duplicateEdges = [];
    const keySet = new Set();
    (edges || []).forEach((edge) => {
      const fromId = getNodeId(edge.from);
      const toId = getNodeId(edge.to);
      const key = `${fromId}->${toId}:${edge.type || 'sequence'}`;
      if (keySet.has(key)) duplicateEdges.push(key);
      keySet.add(key);
    });

    const disconnectedClusters = [];
    const seen = new Set();
    (nodes || []).forEach((node) => {
      if (seen.has(node.id)) return;
      const component = getConnectedComponent(node.id, nodes, edges);
      component.forEach((id) => seen.add(id));
      if (component.length && component.length < nodeMap.size) {
        disconnectedClusters.push(component);
      }
    });

    return {
      orphanNodes,
      duplicateEdges,
      roots: getRoots(nodes, edges),
      hasCycle: opts.detectCycles === false ? false : detectCycles(nodes, edges),
      disconnectedClusters,
      hasMultiParentNodes: (nodes || []).some((node) => (incoming.get(node.id) || []).length > 1)
    };
  }

  root.graph = {
    getAncestors,
    getDescendants,
    getDependencyPath,
    getBranchFromRoot,
    getConnectedComponent,
    getRoots,
    validateGraph
  };
})(window);

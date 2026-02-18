(function initLayoutModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function resolveCollision(nodes, targetNode, minDistance) {
    const distance = Number.isFinite(minDistance) ? minDistance : 180;
    if (!targetNode) return targetNode;

    let moved = { ...targetNode };
    let attempts = 0;

    while (attempts < 60) {
      attempts += 1;
      let overlapping = null;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node || node.id === moved.id) continue;
        const dx = moved.x - node.x;
        const dy = moved.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < distance) {
          overlapping = { node, dx, dy, dist };
          break;
        }
      }

      if (!overlapping) break;
      const safeDist = overlapping.dist || 0.001;
      const nx = overlapping.dx / safeDist;
      const ny = overlapping.dy / safeDist;
      moved.x += nx * (distance - safeDist + 10);
      moved.y += ny * (distance - safeDist + 10);
    }

    return moved;
  }

  function applyRadialTreeLayout(nodes, rootId, radiusStep) {
    const step = Number.isFinite(radiusStep) ? radiusStep : 220;
    const centerNode = nodes.find((node) => node.id === rootId) || nodes[0];
    if (!centerNode) return nodes;

    const updated = [...nodes];
    centerNode.x = centerNode.x || 0;
    centerNode.y = centerNode.y || 0;

    const others = updated.filter((node) => node.id !== centerNode.id);
    const count = Math.max(others.length, 1);

    others.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / count;
      node.x = centerNode.x + Math.cos(angle) * step;
      node.y = centerNode.y + Math.sin(angle) * step;
    });

    return updated;
  }

  function applyForceLayout(nodes, iterations) {
    const rounds = Number.isFinite(iterations) ? Math.max(1, Math.floor(iterations)) : 10;
    const next = nodes.map((node) => ({ ...node }));

    for (let round = 0; round < rounds; round += 1) {
      for (let i = 0; i < next.length; i += 1) {
        for (let j = i + 1; j < next.length; j += 1) {
          const a = next[i];
          const b = next[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = Math.max(dx * dx + dy * dy, 1);
          const force = 1600 / distSq;
          const fx = force * dx;
          const fy = force * dy;
          a.x -= fx;
          a.y -= fy;
          b.x += fx;
          b.y += fy;
        }
      }
    }

    return next;
  }

  function getClusterBounds(nodes, clusterNodeIds) {
    const clusterNodes = nodes.filter((node) => clusterNodeIds.includes(node.id));
    if (!clusterNodes.length) return null;

    const minX = Math.min(...clusterNodes.map((node) => node.x));
    const maxX = Math.max(...clusterNodes.map((node) => node.x));
    const minY = Math.min(...clusterNodes.map((node) => node.y));
    const maxY = Math.max(...clusterNodes.map((node) => node.y));

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  root.layout = {
    resolveCollision,
    applyRadialTreeLayout,
    applyForceLayout,
    getClusterBounds
  };
})(window);

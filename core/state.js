(function initStateModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const defaultState = {
    selectedNodeId: null,
    playbackMode: 'linear',
    zoomState: { x: 0, y: 0, zoom: 1 },
    activeFilters: { tags: [], minPriority: null, type: null },
    dirty: false,
    graph: { nodes: [], edges: [] }
  };

  let state = JSON.parse(JSON.stringify(defaultState));

  function resetState() {
    state = JSON.parse(JSON.stringify(defaultState));
    return state;
  }

  function getState() {
    return state;
  }

  function setDirty(isDirty) {
    state.dirty = !!isDirty;
  }

  function setSelectedNode(nodeId) {
    state.selectedNodeId = nodeId || null;
  }

  function setPlaybackMode(mode) {
    state.playbackMode = mode || 'linear';
  }

  function setZoomState(nextZoomState) {
    if (!nextZoomState || typeof nextZoomState !== 'object') return;
    state.zoomState = {
      x: Number.isFinite(nextZoomState.x) ? nextZoomState.x : state.zoomState.x,
      y: Number.isFinite(nextZoomState.y) ? nextZoomState.y : state.zoomState.y,
      zoom: Number.isFinite(nextZoomState.zoom) ? nextZoomState.zoom : state.zoomState.zoom
    };
  }

  function setActiveFilters(nextFilters) {
    if (!nextFilters || typeof nextFilters !== 'object') return;
    state.activeFilters = {
      tags: Array.isArray(nextFilters.tags) ? nextFilters.tags : state.activeFilters.tags,
      minPriority: Number.isFinite(nextFilters.minPriority) ? nextFilters.minPriority : nextFilters.minPriority === null ? null : state.activeFilters.minPriority,
      type: typeof nextFilters.type === 'string' || nextFilters.type === null ? nextFilters.type : state.activeFilters.type
    };
  }

  function setGraph(nodes, edges) {
    state.graph = {
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : []
    };
  }

  root.state = {
    getState,
    resetState,
    setDirty,
    setSelectedNode,
    setPlaybackMode,
    setZoomState,
    setActiveFilters,
    setGraph
  };
})(window);

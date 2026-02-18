(function initCameraModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function clampZoom(zoom, minZoom, maxZoom) {
    const min = Number.isFinite(minZoom) ? minZoom : 0.001;
    const max = Number.isFinite(maxZoom) ? maxZoom : 64;
    return Math.min(Math.max(zoom, min), max);
  }

  function zoomToFitCluster(bounds, viewport, padding) {
    if (!bounds || !viewport) return null;
    const pad = Number.isFinite(padding) ? Math.max(0, padding) : 80;
    const width = Math.max(1, bounds.width + pad * 2);
    const height = Math.max(1, bounds.height + pad * 2);
    const zoom = Math.min(viewport.width / width, viewport.height / height);
    return {
      zoom,
      x: bounds.minX - pad,
      y: bounds.minY - pad
    };
  }

  root.camera = {
    clampZoom,
    zoomToFitCluster
  };
})(window);

(function initUiModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function applyNodeVisualState(node, element) {
    if (!node || !element) return;
    element.classList.toggle('locked', !!node.locked);
    if (node.colorOverride) {
      element.style.background = node.colorOverride;
    }
    if (node.dueDate) {
      element.dataset.dueDate = node.dueDate;
    } else {
      delete element.dataset.dueDate;
    }
  }

  root.ui = {
    applyNodeVisualState
  };
})(window);

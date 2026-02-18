(function initPersistenceModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const SCHEMA_VERSION = 2;

  function normalizeDate(value) {
    return typeof value === 'string' && value ? value : new Date().toISOString();
  }

  function migrateNode(node, index) {
    const source = node && typeof node === 'object' ? node : {};
    return {
      id: source.id || `node_${index + 1}`,
      text: typeof source.text === 'string' ? source.text : 'New idea',
      x: Number.isFinite(source.x) ? source.x : 0,
      y: Number.isFinite(source.y) ? source.y : 0,
      locked: !!source.locked,
      order: Number.isFinite(source.order) ? source.order : index + 1,
      type: typeof source.type === 'string' ? source.type : 'idea',
      notes: typeof source.notes === 'string' ? source.notes : '',
      tags: Array.isArray(source.tags) ? source.tags.map((tag) => String(tag)) : [],
      priority: Number.isFinite(source.priority) ? source.priority : 0,
      colorOverride: typeof source.colorOverride === 'string' ? source.colorOverride : null,
      dueDate: typeof source.dueDate === 'string' ? source.dueDate : null,
      metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {},
      aiSummary: typeof source.aiSummary === 'string' ? source.aiSummary : '',
      voiceNote: typeof source.voiceNote === 'string' ? source.voiceNote : '',
      createdAt: normalizeDate(source.createdAt),
      updatedAt: normalizeDate(source.updatedAt)
    };
  }

  function migrateEdge(edge, index) {
    const source = edge && typeof edge === 'object' ? edge : {};
    return {
      id: source.id || `edge_${index + 1}`,
      from: source.from,
      to: source.to,
      label: typeof source.label === 'string' ? source.label : '',
      weight: Number.isFinite(source.weight) ? source.weight : 1,
      type: typeof source.type === 'string' ? source.type : 'sequence',
      metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {}
    };
  }

  function migrateSnapshot(rawSnapshot) {
    const raw = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const bubbles = Array.isArray(raw.bubbles) ? raw.bubbles : [];
    const connections = Array.isArray(raw.connections) ? raw.connections : [];

    return {
      schemaVersion: SCHEMA_VERSION,
      mapId: raw.mapId || null,
      mapName: raw.mapName || 'Untitled Map',
      bubbleTypes: raw.bubbleTypes || { labels: {}, locked: false },
      bubbles: bubbles.map((bubble, index) => migrateNode(bubble, index)),
      connections: connections.map((connection, index) => migrateEdge(connection, index))
    };
  }

  function parseSnapshot(snapshot) {
    if (typeof snapshot === 'string') {
      return migrateSnapshot(JSON.parse(snapshot));
    }
    return migrateSnapshot(snapshot);
  }

  function stringifySnapshot(snapshot) {
    return JSON.stringify(migrateSnapshot(snapshot));
  }

  root.persistence = {
    SCHEMA_VERSION,
    parseSnapshot,
    stringifySnapshot,
    migrateSnapshot
  };
})(window);

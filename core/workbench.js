(function initWorkbench(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});
  const endpoint = value => typeof value === 'object' ? value.id : value;
  function storyOrder(nodes, edges, startId) {
    const ids = new Set(nodes.map(n => n.id));
    const incoming = new Set(edges.map(e => endpoint(e.to)));
    const starts = [startId, ...nodes.filter(n => !incoming.has(n.id)).map(n => n.id), ...nodes.map(n => n.id)].filter(id => ids.has(id));
    const adjacency = new Map(nodes.map(n => [n.id, []]));
    edges.forEach(e => { if (ids.has(endpoint(e.from)) && ids.has(endpoint(e.to))) adjacency.get(endpoint(e.from)).push(endpoint(e.to)); });
    const visited = new Set(), order = [];
    for (const id of starts) {
      const stack = [id];
      while (stack.length) {
        const current = stack.pop();
        if (visited.has(current)) continue;
        visited.add(current); order.push(current);
        stack.push(...adjacency.get(current).slice().reverse());
      }
    }
    return order;
  }
  function layout(nodes, edges, mode, startId) {
    if (!nodes.length) return [];
    const byId = new Map(nodes.map(n => [n.id,n]));
    const order = storyOrder(nodes,edges,startId);
    const width = Math.max(240,...nodes.map(n => (n.width || 180)+80));
    const height = Math.max(170,...nodes.map(n => (n.height || 90)+80));
    const originX = Math.min(...nodes.map(n => n.x)), originY = Math.min(...nodes.map(n => n.y));
    const levels = new Map();
    if (mode === 'flowchart') {
      // Breadth-first layers terminate even for cyclic and disconnected graphs.
      const outgoing = new Map(nodes.map(n => [n.id,[]]));
      edges.forEach(e => { if (byId.has(endpoint(e.from)) && byId.has(endpoint(e.to))) outgoing.get(endpoint(e.from)).push(endpoint(e.to)); });
      for (const id of order) {
        if (levels.has(id)) continue;
        levels.set(id,0);const queue=[id];
        for(let i=0;i<queue.length;i++) for(const next of outgoing.get(queue[i])) if(!levels.has(next)){levels.set(next,levels.get(queue[i])+1);queue.push(next);}
      }
    }
    const rows = new Map();
    const placed = nodes.filter(n => n.locked).map(n => ({...n}));
    const result=[];
    order.forEach((id,i) => {
      const node = byId.get(id);let x,y;
      if (node.locked) {result.push({id,x:node.x,y:node.y});return;}
      if(mode === 'mindmap') {
        if(i===0){x=originX;y=originY;}
        else {const angle=(i-1)*Math.PI*2/Math.max(1,order.length-1);const radius=Math.max(width*1.4,order.length*Math.max(width,height)/5);x=originX+Math.cos(angle)*radius;y=originY+Math.sin(angle)*radius;}
      } else if(mode === 'timeline') {x=originX+i*width;y=originY+(i%2)*height*.45;}
      else if(mode === 'flowchart') {const level=levels.get(id);const row=rows.get(level)||0;rows.set(level,row+1);x=originX+level*width;y=originY+row*height;}
      else {const columns=Math.ceil(Math.sqrt(nodes.length));x=originX+(i%columns)*width;y=originY+Math.floor(i/columns)*height;}
      // Respect fixed nodes and heterogeneous sizes without leaving overlaps.
      while(placed.some(other=>x<other.x+(other.width||180)+25&&x+(node.width||180)+25>other.x&&y<other.y+(other.height||90)+25&&y+(node.height||90)+25>other.y))y+=height;
      const position={id,x,y};result.push(position);placed.push({...node,...position});
    });
    return result;
  }
  function validateBackup(raw) {
    if(typeof raw==='string')raw=JSON.parse(raw);
    if(raw && ((raw.mapName!==undefined && typeof raw.mapName!=='string') || (raw.mapId!==undefined && raw.mapId!==null && typeof raw.mapId!=='string')))throw new Error('Invalid map name or identity.');
    if(raw?.bubbleTypes?.labels && (typeof raw.bubbleTypes.labels!=='object' || Object.values(raw.bubbleTypes.labels).some(label=>typeof label!=='string')))throw new Error('Invalid thought type labels.');
    if(!raw || !Array.isArray(raw.bubbles) || !Array.isArray(raw.connections) || raw.bubbles.some(n=>!n||typeof n.text!=='string') || raw.connections.some(e=>!e||!Number.isInteger(e.from)||!Number.isInteger(e.to)||e.from<0||e.to<0||e.from>=raw.bubbles.length||e.to>=raw.bubbles.length))throw new Error('Choose a valid SpeechFlow JSON backup.');
    return raw;
  }
  root.workbench = { layout, storyOrder, validateBackup };
})(window);

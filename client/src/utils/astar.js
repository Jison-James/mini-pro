/**
 * A* Pathfinding with accessibility-aware routing modes
 * 
 * Routing modes:
 * - shortest: Raw distance weights
 * - fastest: Prefers lower crowd levels
 * - wheelchair: Avoids stairs, prefers elevator/ramp
 * - elevator_only: Only uses elevators for vertical movement
 * - energy_efficient: Minimizes stairs usage
 */

class MinHeap {
    constructor() { this.data = []; }
    push(item) {
        this.data.push(item);
        this._bubbleUp(this.data.length - 1);
    }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
        return top;
    }
    get size() { return this.data.length; }
    _bubbleUp(i) {
        while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (this.data[p].f <= this.data[i].f) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
            i = p;
        }
    }
    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
            if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
            if (smallest === i) break;
            [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
            i = smallest;
        }
    }
}

function heuristic(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getEdgeWeight(edge, mode) {
    let w = edge.weight || 1;

    switch (mode) {
        case 'wheelchair':
            if (edge.is_stairs) return Infinity;
            if (!edge.is_wheelchair_accessible) return Infinity;
            if (edge.is_elevator || edge.edge_type === 'ramp') w *= 0.5; // prefer
            break;
        case 'elevator_only':
            if (edge.is_stairs) return Infinity;
            break;
        case 'energy_efficient':
            if (edge.is_stairs) w *= 5;
            if (edge.is_elevator) w *= 0.3;
            break;
        case 'fastest':
            w += (edge.crowd_level || 0) * 2;
            break;
        case 'shortest':
        default:
            break;
    }

    if (edge.is_restricted) w *= 100;
    return w;
}

/**
 * Run A* on a single floor
 * @param {Object[]} nodes - Array of node objects with id, x, y
 * @param {Object[]} edges - Array of edge objects with from_node_id, to_node_id, weight, etc.
 * @param {string} startId - Start node ID
 * @param {string} endId - End node ID
 * @param {string} mode - Routing mode
 * @returns {{ path: string[], cost: number } | null}
 */
export function astar(nodes, edges, startId, endId, mode = 'shortest') {
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    // Build adjacency list
    const adj = {};
    nodes.forEach(n => { adj[n.id] = []; });
    edges.forEach(e => {
        adj[e.from_node_id]?.push(e);
        // Bidirectional
        adj[e.to_node_id]?.push({
            ...e,
            from_node_id: e.to_node_id,
            to_node_id: e.from_node_id
        });
    });

    const start = nodeMap[startId];
    const end = nodeMap[endId];
    if (!start || !end) return null;

    const openSet = new MinHeap();
    const gScore = {};
    const cameFrom = {};
    const closed = new Set();

    gScore[startId] = 0;
    openSet.push({ id: startId, f: heuristic(start, end) });

    while (openSet.size > 0) {
        const current = openSet.pop();
        if (current.id === endId) {
            // Reconstruct path
            const path = [endId];
            let c = endId;
            while (cameFrom[c]) { c = cameFrom[c]; path.unshift(c); }
            return { path, cost: gScore[endId] };
        }

        if (closed.has(current.id)) continue;
        closed.add(current.id);

        for (const edge of (adj[current.id] || [])) {
            const neighborId = edge.to_node_id;
            if (closed.has(neighborId)) continue;

            const w = getEdgeWeight(edge, mode);
            if (w === Infinity) continue;

            const tentG = gScore[current.id] + w;
            if (tentG < (gScore[neighborId] ?? Infinity)) {
                cameFrom[neighborId] = current.id;
                gScore[neighborId] = tentG;
                const neighbor = nodeMap[neighborId];
                if (neighbor) {
                    openSet.push({ id: neighborId, f: tentG + heuristic(neighbor, end) });
                }
            }
        }
    }

    return null; // No path found
}

/**
 * Hierarchical multi-building routing
 * Finds path across buildings/floors using connector nodes
 */
export function hierarchicalRoute(fullGraph, startNodeId, endNodeId, mode = 'shortest') {
    // Flatten all nodes and edges including connector relationships
    const allNodes = [];
    const allEdges = [];
    const nodeFloorMap = {};
    const nodeBuildingMap = {};

    fullGraph.forEach(building => {
        building.floors.forEach(floor => {
            floor.nodes.forEach(n => {
                allNodes.push(n);
                nodeFloorMap[n.id] = floor.id;
                nodeBuildingMap[n.id] = building.id;
            });
            floor.edges.forEach(e => {
                allEdges.push(e);
            });
            // Add virtual edges for connector nodes (same connector pair across floors/buildings)
            floor.nodes.filter(n => ['connector', 'stairs', 'elevator', 'outdoor'].includes(n.node_type)).forEach(n => {
                if (n.connects_to_node_id) {
                    allEdges.push({
                        id: `virtual-${n.id}-${n.connects_to_node_id}`,
                        from_node_id: n.id,
                        to_node_id: n.connects_to_node_id,
                        weight: n.node_type === 'outdoor' ? 5 : (n.node_type === 'elevator' ? 2 : 5),
                        is_stairs: n.node_type === 'stairs' ? 1 : 0,
                        is_elevator: n.node_type === 'elevator' ? 1 : 0,
                        is_wheelchair_accessible: n.node_type !== 'stairs' ? 1 : 0,
                        is_outdoor: n.node_type === 'outdoor' ? 1 : 0,
                        floor_id: floor.id
                    });
                }
            });
        });
    });

    const result = astar(allNodes, allEdges, startNodeId, endNodeId, mode);
    if (!result) return null;

    // Segment path by floor for sequential display
    const segments = [];
    let currentFloor = nodeFloorMap[result.path[0]];
    let currentBuilding = nodeBuildingMap[result.path[0]];
    let segment = { floorId: currentFloor, buildingId: currentBuilding, nodeIds: [result.path[0]] };

    for (let i = 1; i < result.path.length; i++) {
        const nFloor = nodeFloorMap[result.path[i]];
        if (nFloor !== currentFloor) {
            segments.push(segment);
            currentFloor = nFloor;
            currentBuilding = nodeBuildingMap[result.path[i]];
            segment = { floorId: currentFloor, buildingId: currentBuilding, nodeIds: [result.path[i]] };
        } else {
            segment.nodeIds.push(result.path[i]);
        }
    }
    segments.push(segment);

    return { ...result, segments, nodeFloorMap, nodeBuildingMap };
}

/**
 * Get all route suggestions
 */
export function getAllRoutes(nodes, edges, startId, endId) {
    const modes = [
        { key: 'shortest', label: 'Shortest Distance', icon: '📏' },
        { key: 'fastest', label: 'Fastest Route', icon: '⚡' },
        { key: 'wheelchair', label: 'Wheelchair-Friendly', icon: '♿' },
        { key: 'elevator_only', label: 'Elevator Only', icon: '🛗' },
        { key: 'energy_efficient', label: 'Energy Efficient', icon: '🌿' }
    ];

    return modes.map(m => ({
        ...m,
        result: astar(nodes, edges, startId, endId, m.key)
    })).filter(m => m.result !== null);
}

/**
 * Find nodes near the current path
 * @param {Object[]} allNodes - All nodes in the institution
 * @param {string[]} pathNodeIds - IDs of nodes in the path
 * @param {string} query - Search query
 * @param {number} limit - Max results
 */
export function findNodesNearPath(allNodes, pathNodeIds, query, limit = 10) {
    if (!query) return [];

    // 1. Filter candidates by query
    const q = query.toLowerCase();
    const candidates = allNodes.filter(n =>
        n.is_selectable &&
        n.node_type !== 'hidden' &&
        !pathNodeIds.includes(n.id) && // Don't suggest nodes already on path
        (n.name.toLowerCase().includes(q) || (n.description && n.description.toLowerCase().includes(q)) || n.node_type.toLowerCase().includes(q))
    );

    // 2. Calculate distance to path
    const pathSet = new Set(pathNodeIds);
    const pathNodes = allNodes.filter(n => pathSet.has(n.id));

    const results = candidates.map(candidate => {
        let minDist = Infinity;

        // Find closest path node on the SAME floor
        for (const pNode of pathNodes) {
            // Check if same floor (using floorId property which MapViewer adds, or floor_id from DB)
            if ((pNode.floor_id || pNode.floorId) === (candidate.floor_id || candidate.floorId)) {
                // Approximate distance (normalized coordinates)
                const d = Math.sqrt((pNode.x - candidate.x) ** 2 + (pNode.y - candidate.y) ** 2);
                if (d < minDist) minDist = d;
            }
        }

        return { node: candidate, dist: minDist };
    })
        .filter(r => r.dist !== Infinity) // Only reachable on same floor (simplification)
        .sort((a, b) => a.dist - b.dist) // Sort by proximity to route
        .slice(0, limit);

    return results.map(r => r.node);
}

/**
 * Compute route with multiple stops
 * @param {Object} fullGraph 
 * @param {string[]} stopNodeIds - Array of [start, ...waypoints, end]
 * @param {string} mode 
 */
export function computeMultiStopRoute(fullGraph, stopNodeIds, mode = 'shortest') {
    if (stopNodeIds.length < 2) return null;

    let totalCost = 0;
    let combinedPath = [];
    let combinedSegments = [];
    let combinedNodeFloorMap = {};
    let combinedNodeBuildingMap = {};

    for (let i = 0; i < stopNodeIds.length - 1; i++) {
        const from = stopNodeIds[i];
        const to = stopNodeIds[i + 1];

        const result = hierarchicalRoute(fullGraph, from, to, mode);
        if (!result) return null; // Logic break if any segment fails

        totalCost += result.cost;

        // Merge path (avoid duplicating the join node)
        if (i === 0) {
            combinedPath = result.path;
        } else {
            combinedPath = [...combinedPath, ...result.path.slice(1)];
        }

        // Merge maps
        combinedNodeFloorMap = { ...combinedNodeFloorMap, ...result.nodeFloorMap };
        combinedNodeBuildingMap = { ...combinedNodeBuildingMap, ...result.nodeBuildingMap };

        // Merge segments
        // If the last segment of previous leg and first segment of next leg are on same floor/building, merge them?
        // Logic: result.segments is array of { floorId, buildingId, nodeIds }

        if (i === 0) {
            combinedSegments = result.segments;
        } else {
            const lastSeg = combinedSegments[combinedSegments.length - 1];
            const firstSeg = result.segments[0];

            if (lastSeg.floorId === firstSeg.floorId && lastSeg.buildingId === firstSeg.buildingId) {
                // Merge
                lastSeg.nodeIds = [...lastSeg.nodeIds, ...firstSeg.nodeIds.slice(1)]; // slice 1 to avoid duplicate join node
                combinedSegments = [...combinedSegments, ...result.segments.slice(1)];
            } else {
                combinedSegments = [...combinedSegments, ...result.segments];
            }
        }
    }

    return {
        path: combinedPath,
        cost: totalCost,
        segments: combinedSegments,
        nodeFloorMap: combinedNodeFloorMap,
        nodeBuildingMap: combinedNodeBuildingMap
    };
}

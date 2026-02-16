import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInstitution, getFullGraph, logNavigation, searchNodes, saveMap, requestAccess } from '../utils/api';
import { astar, hierarchicalRoute, getAllRoutes, findNodesNearPath, computeMultiStopRoute } from '../utils/astar';
import { parseNavigation, findBestMatch } from '../utils/nlpParser';

const NODE_COLORS = {
    normal: '#6366f1', hidden: '#4b5563', connector: '#f59e0b',
    stairs: '#ef4444', elevator: '#3b82f6', ramp: '#10b981',
    emergency_exit: '#ef4444', restricted: '#991b1b',
};

export default function MapViewer() {
    const { institutionId } = useParams();
    const { user } = useAuth();
    const canvasRef = useRef(null);

    const [institution, setInstitution] = useState(null);
    const [fullGraph, setFullGraph] = useState([]);
    const [allNodes, setAllNodes] = useState([]);
    const [allEdges, setAllEdges] = useState([]);
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [selectedFloor, setSelectedFloor] = useState(null);
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [routeMode, setRouteMode] = useState('shortest');
    const [pathResult, setPathResult] = useState(null);
    const [routeOptions, setRouteOptions] = useState([]);
    const [currentSegment, setCurrentSegment] = useState(0);
    const [showGraph, setShowGraph] = useState(false);
    const [floorImage, setFloorImage] = useState(null);
    const [mainMapImage, setMainMapImage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [nlpInput, setNlpInput] = useState('');
    const [startSearch, setStartSearch] = useState('');
    const [endSearch, setEndSearch] = useState('');
    const [startResults, setStartResults] = useState([]);
    const [endResults, setEndResults] = useState([]);
    const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 700 });
    const [comments, setComments] = useState([]);
    const [waypoints, setWaypoints] = useState([]);
    const [stopSearchQuery, setStopSearchQuery] = useState('');
    const [stopSearchResults, setStopSearchResults] = useState([]);
    const [showAddStop, setShowAddStop] = useState(false);
    const [accessError, setAccessError] = useState(null); // { message, access_required, key_required }
    const [requestingAccess, setRequestingAccess] = useState(false);
    const [accessKeyInput, setAccessKeyInput] = useState('');

    useEffect(() => { if (startNode && endNode) computeRoute(); }, [waypoints]);

    useEffect(() => { loadData(); }, [institutionId]);
    useEffect(() => {
        if (selectedFloor) loadFloorImage();
        else setFloorImage(null);
    }, [selectedFloor]);
    useEffect(() => {
        if (institution?.main_map_url) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { setMainMapImage(img); if (!selectedBuilding) setCanvasSize({ w: img.width || 1000, h: img.height || 700 }); };
            img.src = `${UPLOADS_BASE}${institution.main_map_url}`;
        }
    }, [institution, selectedBuilding]);

    async function loadData(key = '') {
        try {
            setAccessError(null);
            const [inst, graph] = await Promise.all([
                getInstitution(institutionId, key),
                getFullGraph(institutionId, key)
            ]);
            setInstitution(inst);
            setFullGraph(graph);

            // Flatten
            const an = [], ae = [];
            graph.forEach(b => b.floors.forEach(f => {
                f.nodes.forEach(n => an.push({ ...n, buildingName: b.name, floorNumber: f.floor_number, floorId: f.id, buildingId: b.id }));
                f.edges.forEach(e => ae.push(e));
            }));
            setAllNodes(an);
            setAllEdges(ae);

            if (graph.length > 0 && !inst.main_map_url) {
                setSelectedBuilding(graph[0]);
                if (graph[0].floors.length > 0) setSelectedFloor(graph[0].floors[0]);
            } else if (inst.main_map_url) {
                // Default to Overview
                setSelectedBuilding(null);
                setSelectedFloor(null);
                setCanvasSize({ w: 1000, h: 700 }); // Default or load from image
            }
        } catch (e) {
            console.error(e);
            if (e.message.includes('Access denied')) {
                setAccessError({
                    message: e.message,
                    access_required: true,
                    key_required: e.key_required
                });
            } else {
                setAccessError({ message: 'Failed to load map data. ' + e.message, access_required: false });
            }
        }
    }

    function loadFloorImage() {
        if (selectedFloor?.image_url) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { setFloorImage(img); setCanvasSize({ w: img.width || 1000, h: img.height || 700 }); };
            img.src = `${UPLOADS_BASE}${selectedFloor.image_url}`;
        } else {
            setFloorImage(null);
        }
    }

    // Compute route
    function computeRoute(mode = routeMode) {
        if (!startNode || !endNode) return;

        // Try hierarchical routing
        let result;
        if (waypoints.length > 0) {
            const stops = [startNode.id, ...waypoints.map(w => w.id), endNode.id];
            result = computeMultiStopRoute(fullGraph, stops, mode);
        } else {
            result = hierarchicalRoute(fullGraph, startNode.id, endNode.id, mode);
        }
        setPathResult(result);
        setRouteMode(mode);

        // Get all route options
        const options = getAllRoutes(allNodes, allEdges, startNode.id, endNode.id);
        setRouteOptions(options);

        if (result?.segments?.length > 0) {
            setCurrentSegment(0);
            const seg = result.segments[0];
            const building = fullGraph.find(b => b.floors.some(f => f.id === seg.floorId));
            const floor = building?.floors.find(f => f.id === seg.floorId);
            if (building) setSelectedBuilding(building);
            if (floor) setSelectedFloor(floor);
        }

        // Log navigation
        logNavigation({
            institution_id: institutionId,
            from_node_name: startNode.name,
            to_node_name: endNode.name,
            route_mode: mode,
            path_nodes: result?.path,
        }).catch(() => { });
    }

    // Navigate segments
    function goToSegment(idx) {
        if (!pathResult?.segments) return;
        setCurrentSegment(idx);
        const seg = pathResult.segments[idx];
        const building = fullGraph.find(b => b.floors.some(f => f.id === seg.floorId));
        const floor = building?.floors.find(f => f.id === seg.floorId);
        if (building) setSelectedBuilding(building);
        if (floor) setSelectedFloor(floor);
    }

    // NLP parse
    function handleNlpSubmit(e) {
        e.preventDefault();
        const parsed = parseNavigation(nlpInput);
        if (!parsed) return;

        const selectableNodes = allNodes.filter(n => n.is_selectable);
        if (parsed.destination) {
            const dest = findBestMatch(parsed.destination, selectableNodes);
            if (dest) setEndNode(dest);
        }
        if (parsed.start) {
            const start = findBestMatch(parsed.start, selectableNodes);
            if (start) setStartNode(start);
        }
    }

    // Search handling
    function handleStartSearch(q) {
        setStartSearch(q);
        if (q.length > 0) {
            setStartResults(allNodes.filter(n => n.is_selectable && n.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10));
        } else setStartResults([]);
    }

    function handleEndSearch(q) {
        setEndSearch(q);
        if (q.length > 0) {
            setEndResults(allNodes.filter(n => n.is_selectable && n.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10));
        } else setEndResults([]);
    }

    function handleStopSearch(q) {
        setStopSearchQuery(q);
        if (q.length > 0) {
            setStopSearchResults(allNodes.filter(n => n.is_selectable && n.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10));
        } else {
            setStopSearchResults([]);
        }
    }

    function addWaypoint(node) {
        setWaypoints([...waypoints, node]);
        setStopSearchQuery('');
        setStopSearchResults([]);
        setShowAddStop(false);
    }

    function removeWaypoint(index) {
        const newWaypoints = [...waypoints];
        newWaypoints.splice(index, 1);
        setWaypoints(newWaypoints);
    }

    async function handleRequestAccess() {
        if (!user) {
            alert('Please login to request access');
            return;
        }
        try {
            setRequestingAccess(true);
            await requestAccess(institutionId, `Requesting access for ${user.email}`);
            alert('Access request submitted successfully!');
            loadData(); // Reload to see if access pending state changed (optional)
        } catch (e) {
            alert(e.message);
        } finally {
            setRequestingAccess(false);
        }
    }

    // Canvas rendering
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { w, h } = canvasSize;
        canvas.width = w;
        canvas.height = h;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        if (floorImage) {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(floorImage, 0, 0, w, h);
            ctx.globalAlpha = 1;
        } else if (!selectedBuilding && mainMapImage) {
            ctx.drawImage(mainMapImage, 0, 0, w, h);
        }

        // Get current floor nodes and edges
        const floorNodes = selectedFloor ? allNodes.filter(n => n.floor_id === selectedFloor.id) : [];
        const floorEdges = selectedFloor ? allEdges.filter(e => e.floor_id === selectedFloor.id) : [];

        // Get path nodes for current floor
        const currentSegmentData = pathResult?.segments?.[currentSegment];
        const pathNodeIds = currentSegmentData?.nodeIds || [];
        const pathNodeSet = new Set(pathResult?.path || []);

        if (showGraph || pathResult) {
            // Draw edges
            floorEdges.forEach(edge => {
                const from = floorNodes.find(n => n.id === edge.from_node_id);
                const to = floorNodes.find(n => n.id === edge.to_node_id);
                if (!from || !to) return;

                const isOnPath = pathNodeSet.has(edge.from_node_id) && pathNodeSet.has(edge.to_node_id);

                if (showGraph || isOnPath) {
                    ctx.beginPath();
                    ctx.moveTo(from.x * w, from.y * h);
                    ctx.lineTo(to.x * w, to.y * h);

                    if (isOnPath) {
                        ctx.strokeStyle = '#10b981';
                        ctx.lineWidth = 4;
                        ctx.shadowColor = '#10b981';
                        ctx.shadowBlur = 10;
                    } else {
                        ctx.strokeStyle = 'rgba(99,102,241,0.2)';
                        ctx.lineWidth = 1;
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            });

            // Draw nodes
            floorNodes.forEach(node => {
                if (node.node_type === 'hidden' && !showGraph) return;
                const nx = node.x * w, ny = node.y * h;
                const isOnPath = pathNodeSet.has(node.id);
                const isStart = startNode?.id === node.id;
                const isEnd = endNode?.id === node.id;
                const r = isStart || isEnd ? 12 : isOnPath ? 8 : 6;

                // Glow for path nodes
                if (isStart || isEnd) {
                    ctx.beginPath();
                    ctx.arc(nx, ny, r + 8, 0, Math.PI * 2);
                    ctx.fillStyle = isStart ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(nx, ny, r, 0, Math.PI * 2);
                ctx.arc(nx, ny, r, 0, Math.PI * 2);
                const wpIndex = waypoints.findIndex(wp => wp.id === node.id);
                ctx.fillStyle = isStart ? '#10b981' : isEnd ? '#ef4444' : wpIndex >= 0 ? '#f97316' : isOnPath ? '#f59e0b' : (NODE_COLORS[node.node_type] || '#6366f1');
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = isOnPath ? 2 : 1;
                ctx.stroke();

                // Label
                if (node.node_type !== 'hidden' && (showGraph || isOnPath || isStart || isEnd)) {
                    ctx.fillStyle = '#fff';
                    ctx.font = `${isStart || isEnd ? 'bold 13px' : '11px'} Inter`;
                    ctx.textAlign = 'center';
                    ctx.textAlign = 'center';
                    const wpIndex = waypoints.findIndex(wp => wp.id === node.id);
                    const label = isStart ? `🟢 ${node.name}` : isEnd ? `🔴 ${node.name}` : wpIndex >= 0 ? `🟠 ${wpIndex + 1}. ${node.name}` : node.name;
                    ctx.fillText(label, nx, ny - r - 6);
                }
            });
        }

        // If no graph, show building labels
        if (!showGraph && !pathResult && floorNodes.filter(n => n.node_type !== 'hidden').length > 0) {
            floorNodes.filter(n => n.is_selectable && n.node_type !== 'hidden').forEach(node => {
                const nx = node.x * w, ny = node.y * h;
                ctx.beginPath();
                ctx.arc(nx, ny, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(99,102,241,0.6)';
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '10px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(node.name, nx, ny - 10);
            });
        }
    }, [allNodes, allEdges, selectedFloor, floorImage, mainMapImage, canvasSize, showGraph, pathResult, currentSegment, startNode, endNode, selectedBuilding]);

    useEffect(() => { draw(); }, [draw]);

    function handleCanvasClick(e) {
        const rect = canvasRef.current.getBoundingClientRect();
        const pos = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
        const floorNodes = allNodes.filter(n => n.floor_id === selectedFloor?.id && n.is_selectable);
        const clicked = floorNodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < 0.02);
        if (clicked) {
            if (!startNode) { setStartNode(clicked); setStartSearch(clicked.name); }
            else if (!endNode) { setEndNode(clicked); setEndSearch(clicked.name); }
        }
    }

    return (
        <div className="page">
            <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
                {/* Navigation Panel */}
                <div style={{ width: 360, borderRight: '1px solid var(--border-color)', overflowY: 'auto', padding: 20, background: 'rgba(10,14,26,0.5)' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>🧭 {institution?.name || 'Navigation'}</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>{institution?.address}</p>

                    {/* View Controls */}
                    <div style={{ marginBottom: 16 }}>
                        {!selectedBuilding ? (
                            institution?.main_map_url && fullGraph.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>BROWSE BUILDINGS</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {fullGraph.map(b => (
                                            <button key={b.id} className="btn btn-secondary btn-xs" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setSelectedBuilding(b); if (b.floors.length > 0) setSelectedFloor(b.floors[0]); }}>
                                                {b.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Viewing</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedBuilding.name}</p>
                                    </div>
                                    {institution?.main_map_url && (
                                        <button className="btn btn-secondary btn-xs" style={{ fontSize: '0.7rem' }} onClick={() => { setSelectedBuilding(null); setSelectedFloor(null); }}>
                                            Overview
                                        </button>
                                    )}
                                </div>
                                {/* Floor Selector */}
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {selectedBuilding.floors.map(f => (
                                        <button key={f.id} className={`btn btn-xs ${selectedFloor?.id === f.id ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSelectedFloor(f)}
                                            style={{ fontSize: '0.75rem', padding: '2px 8px', opacity: selectedFloor?.id === f.id ? 1 : 0.6 }}>
                                            {f.floor_number}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* NLP Input */}
                    <form onSubmit={handleNlpSubmit} style={{ marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label>💬 Natural Language</label>
                            <input className="form-input" value={nlpInput} onChange={e => setNlpInput(e.target.value)} placeholder='e.g., "Take me to Lab 3 from Main Gate"' />
                        </div>
                        <button className="btn btn-primary btn-sm" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Parse & Navigate</button>
                    </form>

                    <div style={{ height: 1, background: 'var(--border-color)', margin: '12px 0' }} />

                    {/* Start / End inputs */}
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>🟢 Start</label>
                        <input className="form-input" value={startSearch} onChange={e => handleStartSearch(e.target.value)} placeholder="Search start location..." />
                        {startResults.length > 0 && (
                            <div className="search-results">
                                {startResults.map(n => (
                                    <div key={n.id} className="search-result-item" onClick={() => { setStartNode(n); setStartSearch(n.name); setStartResults([]); }}>
                                        <span style={{ fontWeight: 600 }}>{n.name}</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>{n.buildingName} F{n.floorNumber}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Waypoints */}
                    <div style={{ marginBottom: 16 }}>
                        {waypoints.map((wp, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, padding: '8px', background: 'rgba(249,115,22,0.1)', borderRadius: 4, borderLeft: '3px solid #f97316' }}>
                                <span style={{ fontSize: '0.8rem', marginRight: 8 }}>🟠 {i + 1}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{wp.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{wp.buildingName} F{wp.floorNumber}</div>
                                </div>
                                <button onClick={() => removeWaypoint(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                            </div>
                        ))}

                        {!showAddStop ? (
                            <button className="btn btn-secondary btn-xs" onClick={() => setShowAddStop(true)} style={{ width: '100%', borderStyle: 'dashed' }}>+ Add Stop</button>
                        ) : (
                            <div className="form-group" style={{ position: 'relative' }}>
                                <input className="form-input" autoFocus value={stopSearchQuery} onChange={e => handleStopSearch(e.target.value)} placeholder="Search stop..." />
                                <button onClick={() => setShowAddStop(false)} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                                {stopSearchResults.length > 0 && (
                                    <div className="search-results">
                                        {stopSearchResults.map(n => (
                                            <div key={n.id} className="search-result-item" onClick={() => addWaypoint(n)}>
                                                <span style={{ fontWeight: 600 }}>{n.name}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>{n.buildingName} F{n.floorNumber}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>🔴 Destination</label>
                        <input className="form-input" value={endSearch} onChange={e => handleEndSearch(e.target.value)} placeholder="Search destination..." />
                        {endResults.length > 0 && (
                            <div className="search-results">
                                {endResults.map(n => (
                                    <div key={n.id} className="search-result-item" onClick={() => { setEndNode(n); setEndSearch(n.name); setEndResults([]); }}>
                                        <span style={{ fontWeight: 600 }}>{n.name}</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>{n.buildingName} F{n.floorNumber}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                        onClick={() => computeRoute()} disabled={!startNode || !endNode}>
                        🧭 Find Route
                    </button>

                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                        onClick={() => {
                            setStartNode(null); setEndNode(null); setPathResult(null); setRouteOptions([]);
                            setStartSearch(''); setEndSearch(''); setNlpInput(''); setCurrentSegment(0);
                        }}>
                        ↺ Clear
                    </button>

                    {/* Route Options */}
                    {routeOptions.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Route Options</h3>
                            {routeOptions.map(opt => (
                                <div key={opt.key} className={`route-option ${routeMode === opt.key ? 'selected' : ''}`}
                                    onClick={() => computeRoute(opt.key)}>
                                    <span className="route-icon">{opt.icon}</span>
                                    <div className="route-info">
                                        <h4>{opt.label}</h4>
                                        <p>Cost: {opt.result.cost.toFixed(1)} • {opt.result.path.length} nodes</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}



                    {/* Path Segments */}
                    {pathResult?.segments?.length > 1 && (
                        <div style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Path Segments</h3>
                            {pathResult.segments.map((seg, i) => {
                                const building = fullGraph.find(b => b.floors.some(f => f.id === seg.floorId));
                                const floor = building?.floors.find(f => f.id === seg.floorId);
                                return (
                                    <div key={i} className={`route-option ${currentSegment === i ? 'selected' : ''}`} onClick={() => goToSegment(i)}>
                                        <span>{i < currentSegment ? '✅' : i === currentSegment ? '📍' : '⬜'}</span>
                                        <div>
                                            <h4 style={{ fontSize: '0.8125rem' }}>{building?.name} — Floor {floor?.floor_number}</h4>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{seg.nodeIds.length} nodes</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary btn-sm" disabled={currentSegment === 0} onClick={() => goToSegment(currentSegment - 1)} style={{ flex: 1 }}>← Prev</button>
                                <button className="btn btn-primary btn-sm" disabled={currentSegment === pathResult.segments.length - 1} onClick={() => goToSegment(currentSegment + 1)} style={{ flex: 1 }}>Next →</button>
                            </div>
                        </div>
                    )}

                    {/* Building / Floor Selector */}
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '12px 0' }} />
                    <div className="form-group">
                        <label>Building</label>
                        <select className="form-select" value={selectedBuilding?.id || ''} onChange={e => {
                            const b = fullGraph.find(b => b.id === e.target.value);
                            setSelectedBuilding(b || null);
                            if (b?.floors.length) setSelectedFloor(b.floors[0]);
                            else setSelectedFloor(null);
                        }}>
                            <option value="">Overview Map</option>
                            {fullGraph.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    {selectedBuilding?.floors?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                            {selectedBuilding.floors.map(f => (
                                <button key={f.id} className={`floor-step ${selectedFloor?.id === f.id ? 'active' : ''}`}
                                    onClick={() => setSelectedFloor(f)}>
                                    F{f.floor_number}
                                </button>
                            ))}
                        </div>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                        <input type="checkbox" checked={showGraph} onChange={e => setShowGraph(e.target.checked)} /> Show full graph
                    </label>

                    {user && (
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                            onClick={async () => { try { await saveMap(institutionId); alert('Map saved!'); } catch (e) { alert(e.message); } }}>
                            💾 Save Map
                        </button>
                    )}
                </div>

                {/* Canvas */}
                <div style={{ flex: 1, background: '#0d1117', position: 'relative' }}>
                    <canvas ref={canvasRef} onClick={handleCanvasClick}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair', opacity: accessError ? 0.3 : 1 }} />

                    {accessError && (
                        <div className="modal-overlay" style={{ position: 'absolute', background: 'rgba(13, 17, 23, 0.8)' }}>
                            <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
                                <h2 style={{ color: '#ef4444' }}>🔒 Access Restricted</h2>
                                <p style={{ margin: '16px 0', color: 'var(--text-secondary)' }}>
                                    {accessError.message}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {accessError.key_required && (
                                        <div className="form-group" style={{ marginBottom: 16 }}>
                                            <input type="text" className="form-control" placeholder="Enter Access Key"
                                                value={accessKeyInput} onChange={e => setAccessKeyInput(e.target.value)} />
                                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
                                                onClick={() => loadData(accessKeyInput)}>
                                                Verify Key & Unlock Map
                                            </button>
                                        </div>
                                    )}
                                    {accessError.access_required && user ? (
                                        <button className="btn btn-primary" onClick={handleRequestAccess} disabled={requestingAccess}>
                                            {requestingAccess ? 'Submitting...' : 'Request Access Permission'}
                                        </button>
                                    ) : !user ? (
                                        <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>
                                            Login to Request Access
                                        </button>
                                    ) : null}
                                    <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
                                        Back to Home
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {pathResult && pathResult.segments && pathResult.segments.length > 1 && (
                        <div className="floor-stepper">
                            {pathResult.segments.map((seg, i) => {
                                const building = fullGraph.find(b => b.floors.some(f => f.id === seg.floorId));
                                const floor = building?.floors.find(f => f.id === seg.floorId);
                                return (
                                    <button key={i} className={`floor-step ${i === currentSegment ? 'active' : i < currentSegment ? 'visited' : ''}`}
                                        onClick={() => goToSegment(i)}>
                                        {building?.name?.charAt(0)}{floor?.floor_number}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

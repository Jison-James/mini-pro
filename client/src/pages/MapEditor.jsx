import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    getInstitution, getBuildings, getFloors, createFloor,
    getNodes, createNode, updateNode, deleteNode,
    getEdges, createEdge, updateEdge, deleteEdge, getFullGraph, updateInstitution,
    UPLOADS_BASE
} from '../utils/api';

const NODE_COLORS = {
    normal: '#6366f1', hidden: '#4b5563', connector: '#f59e0b',
    stairs: '#ef4444', elevator: '#3b82f6', ramp: '#10b981',
    emergency_exit: '#ef4444', restricted: '#991b1b', outdoor: '#10b981',
};
const NODE_ICONS = {
    normal: '📍', hidden: '·', connector: '🔗', stairs: '🪜',
    elevator: '🛗', ramp: '♿', emergency_exit: '🚨', restricted: '⛔', outdoor: '🌳',
};

export default function MapEditor() {
    const { institutionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animRef = useRef(null);

    const [institution, setInstitution] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [floors, setFloors] = useState([]);
    const [selectedFloor, setSelectedFloor] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [fullGraph, setFullGraph] = useState([]);
    const [tool, setTool] = useState('select');
    const [nodeType, setNodeType] = useState('normal');
    const [showGraph, setShowGraph] = useState(true);
    const [floorImage, setFloorImage] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [edgeStart, setEdgeStart] = useState(null);
    const [editModal, setEditModal] = useState(null);
    const [newNodeName, setNewNodeName] = useState('');
    const [edgeWeight, setEdgeWeight] = useState(1);
    const [edgeProps, setEdgeProps] = useState({});
    const [showFloorForm, setShowFloorForm] = useState(false);
    const [newFloorNum, setNewFloorNum] = useState(0);
    const [newFloorName, setNewFloorName] = useState('');
    const [newFloorImage, setNewFloorImage] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [newMainMap, setNewMainMap] = useState(null);
    const [createBidirectional, setCreateBidirectional] = useState(false);

    // Drag state
    const [dragging, setDragging] = useState(null); // { nodeId, startX, startY }
    const [mousePos, setMousePos] = useState(null);

    // Use refs for drag state to avoid stale closures
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const draggingRef = useRef(dragging);
    draggingRef.current = dragging;
    const wasDraggedRef = useRef(false);

    useEffect(() => { loadInstitution(); }, [institutionId]);
    useEffect(() => { if (selectedBuilding) loadFloors(); }, [selectedBuilding]);
    useEffect(() => { if (selectedFloor) loadFloorData(); }, [selectedFloor]);

    // Resize canvas to match container
    useEffect(() => {
        function resizeCanvas() {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    async function loadInstitution() {
        try {
            const inst = await getInstitution(institutionId);
            setInstitution(inst);
            const blds = await getBuildings(institutionId);
            setBuildings(blds);
            // Select building from query param or default to first
            const qBuilding = searchParams.get('building');
            const match = qBuilding && blds.find(b => b.id === qBuilding);
            if (match) setSelectedBuilding(match);
            else if (blds.length > 0) setSelectedBuilding(blds[0]);
        } catch (e) { console.error(e); }
    }

    async function loadFloors() {
        try {
            const fls = await getFloors(selectedBuilding.id);
            setFloors(fls);
            // Select floor from query param or default to first
            const qFloor = searchParams.get('floor');
            const match = qFloor && fls.find(f => f.id === qFloor);
            if (match) setSelectedFloor(match);
            else if (fls.length > 0) setSelectedFloor(fls[0]);
        } catch (e) { console.error(e); }
    }

    async function loadFloorData() {
        try {
            const [n, e] = await Promise.all([getNodes(selectedFloor.id), getEdges(selectedFloor.id)]);
            setNodes(n);
            setEdges(e);
            if (selectedFloor.image_url) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => setFloorImage(img);
                img.onerror = () => setFloorImage(null);
                img.src = `${UPLOADS_BASE}${selectedFloor.image_url}`;
            } else {
                setFloorImage(null);
            }
        } catch (e) { console.error(e); }
    }

    useEffect(() => {
        if (editModal?.data?.node_type === 'outdoor' && fullGraph.length === 0) {
            console.log('Loading full graph for outdoor linking...');
            getFullGraph(institutionId).then(g => {
                console.log('Full graph loaded:', g);
                setFullGraph(g);
            }).catch(console.error);
        }
    }, [editModal, institutionId, fullGraph.length]);


    // Get click position in normalized 0-1 coords relative to the canvas element
    function getCanvasPos(e) {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        };
    }

    function findNodeAt(pos, nodeList) {
        const list = nodeList || nodes;
        const canvas = canvasRef.current;
        if (!canvas) return null;
        // Use pixel-based hit detection: convert both to pixels
        const cw = canvas.width, ch = canvas.height;
        const px = pos.x * cw, py = pos.y * ch;
        let closest = null, closestDist = Infinity;
        for (const n of list) {
            const nx = n.x * cw, ny = n.y * ch;
            const dist = Math.hypot(px - nx, py - ny);
            if (dist < 15 && dist < closestDist) { // 15 pixel hit radius
                closest = n;
                closestDist = dist;
            }
        }
        return closest;
    }

    function findEdgeAt(pos) {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const cw = canvas.width, ch = canvas.height;
        const px = pos.x * cw, py = pos.y * ch;
        return edges.find(e => {
            const from = nodes.find(n => n.id === e.from_node_id);
            const to = nodes.find(n => n.id === e.to_node_id);
            if (!from || !to) return false;
            const d = distPointToLinePx(px, py, from.x * cw, from.y * ch, to.x * cw, to.y * ch);
            return d < 8; // 8 pixel hit radius for edges
        });
    }

    function distPointToLinePx(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // --- Mouse handlers for drag ---
    function handleMouseDown(e) {
        if (e.button !== 0) return; // left click only
        const pos = getCanvasPos(e);

        if (tool === 'select') {
            const node = findNodeAt(pos);
            if (node) {
                setSelectedNode(node);
                setSelectedEdge(null);
                setDragging({ nodeId: node.id, startX: node.x, startY: node.y });
                return;
            }
        }
    }

    function handleMouseMove(e) {
        const pos = getCanvasPos(e);
        setMousePos(pos);

        if (draggingRef.current && tool === 'select') {
            e.preventDefault();
            wasDraggedRef.current = true;
            // Clamp to 0-1
            const nx = Math.max(0, Math.min(1, pos.x));
            const ny = Math.max(0, Math.min(1, pos.y));
            setNodes(prev => prev.map(n =>
                n.id === draggingRef.current.nodeId ? { ...n, x: nx, y: ny } : n
            ));
        }
    }

    async function handleMouseUp(e) {
        if (draggingRef.current) {
            const drag = draggingRef.current;
            const movedNode = nodesRef.current.find(n => n.id === drag.nodeId);
            // Only save if position actually changed
            if (movedNode && (Math.abs(movedNode.x - drag.startX) > 0.001 || Math.abs(movedNode.y - drag.startY) > 0.001)) {
                try {
                    await updateNode(drag.nodeId, { x: movedNode.x, y: movedNode.y });
                } catch (e) { console.error('Failed to save node position:', e); }
            }
            setDragging(null);
        }
    }

    async function handleCanvasClick(e) {
        // Ignore click if we just finished dragging
        if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }

        const pos = getCanvasPos(e);

        if (tool === 'select') {
            const node = findNodeAt(pos);
            if (node) { setSelectedNode(node); setSelectedEdge(null); return; }
            const edge = findEdgeAt(pos);
            if (edge) { setSelectedEdge(edge); setSelectedNode(null); return; }
            setSelectedNode(null); setSelectedEdge(null);
        } else if (tool === 'node' && selectedFloor) {
            const name = nodeType === 'hidden' ? `.hidden_${nodes.length}` : newNodeName || `Node ${nodes.length + 1}`;
            try {
                const created = await createNode(selectedFloor.id, {
                    name, x: pos.x, y: pos.y, node_type: nodeType,
                    is_selectable: nodeType !== 'hidden'
                });
                setNodes(prev => [...prev, {
                    id: created.id, name, x: pos.x, y: pos.y,
                    floor_id: selectedFloor.id, node_type: nodeType,
                    is_selectable: nodeType !== 'hidden' ? 1 : 0
                }]);
                setNewNodeName('');
            } catch (e) { alert(e.message); }
        } else if (tool === 'edge') {
            const node = findNodeAt(pos);
            if (node) {
                if (!edgeStart) {
                    setEdgeStart(node.id);
                } else if (node.id !== edgeStart) {
                    try {
                        const from = nodes.find(n => n.id === edgeStart);
                        const canvas = canvasRef.current;
                        const dist = Math.hypot((node.x - from.x) * canvas.width, (node.y - from.y) * canvas.height);
                        const w = parseFloat(edgeWeight) || Math.round(dist / 10) || 1;
                        const created = await createEdge(selectedFloor.id, {
                            from_node_id: edgeStart, to_node_id: node.id, weight: w,
                            ...edgeProps
                        });
                        setEdges(prev => [...prev, {
                            id: created.id, floor_id: selectedFloor.id, weight: w,
                            from_node_id: edgeStart, to_node_id: node.id, ...edgeProps
                        }]);
                    } catch (e) { alert(e.message); }
                    setEdgeStart(null);
                }
            }
        }
    }

    function handleCanvasDblClick(e) {
        const pos = getCanvasPos(e);
        const node = findNodeAt(pos);
        if (node) { setEditModal({ type: 'node', data: { ...node } }); return; }
        const edge = findEdgeAt(pos);
        if (edge) { setEditModal({ type: 'edge', data: { ...edge } }); }
    }

    // --- Canvas rendering with requestAnimationFrame ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        // Floor image (fit to canvas)
        if (floorImage) {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(floorImage, 0, 0, w, h);
            ctx.globalAlpha = 1;
        } else {
            // Grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
            for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        }

        if (!showGraph) return;

        // Draw edges
        edges.forEach(edge => {
            const from = nodes.find(n => n.id === edge.from_node_id);
            const to = nodes.find(n => n.id === edge.to_node_id);
            if (!from || !to) return;
            const fx = from.x * w, fy = from.y * h, tx = to.x * w, ty = to.y * h;

            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = selectedEdge?.id === edge.id ? '#f59e0b' : edge.is_stairs ? '#ef4444' : edge.is_elevator ? '#3b82f6' : 'rgba(99,102,241,0.5)';
            ctx.lineWidth = selectedEdge?.id === edge.id ? 3 : 2;
            ctx.stroke();

            // Weight label
            const mx = (fx + tx) / 2, my = (fy + ty) / 2;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(edge.weight?.toFixed?.(1) || '1.0', mx, my - 6);
        });

        // Draw dashed line for edge being created
        if (edgeStart && mousePos) {
            const from = nodes.find(n => n.id === edgeStart);
            if (from) {
                ctx.beginPath();
                ctx.setLineDash([6, 4]);
                ctx.moveTo(from.x * w, from.y * h);
                ctx.lineTo(mousePos.x * w, mousePos.y * h);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw nodes
        nodes.forEach(node => {
            const nx = node.x * w, ny = node.y * h;
            const r = node.node_type === 'hidden' ? 4 : 8;
            const color = NODE_COLORS[node.node_type] || NODE_COLORS.normal;
            const isSelected = selectedNode?.id === node.id;
            const isDragged = dragging?.nodeId === node.id;

            // Glow for selected / dragged
            if (isSelected || isDragged) {
                ctx.beginPath();
                ctx.arc(nx, ny, r + 8, 0, Math.PI * 2);
                ctx.fillStyle = isDragged ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.3)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(nx, ny, r, 0, Math.PI * 2);
            ctx.fillStyle = isDragged ? '#f59e0b' : color;
            ctx.fill();
            ctx.strokeStyle = isSelected || isDragged ? '#fff' : 'rgba(255,255,255,0.4)';
            ctx.lineWidth = isSelected || isDragged ? 2 : 1;
            ctx.stroke();

            // Label
            if (node.node_type !== 'hidden') {
                ctx.fillStyle = '#fff';
                ctx.font = `${isSelected ? 'bold 12px' : '11px'} Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(node.name, nx, ny - r - 6);
            }
        });

        // Draw crosshair cursor for node/edge tool
        if (mousePos && (tool === 'node' || tool === 'edge')) {
            const cx = mousePos.x * w, cy = mousePos.y * h;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
            ctx.setLineDash([]);
        }
    }, [nodes, edges, floorImage, showGraph, selectedNode, selectedEdge, edgeStart, dragging, mousePos, tool]);

    // Render loop
    useEffect(() => {
        let running = true;
        function loop() {
            if (!running) return;
            draw();
            animRef.current = requestAnimationFrame(loop);
        }
        loop();
        return () => { running = false; cancelAnimationFrame(animRef.current); };
    }, [draw]);

    async function handleNodeUpdate() {
        if (!editModal) return;
        try {
            await updateNode(editModal.data.id, editModal.data);

            if (editModal.data.node_type === 'outdoor' && createBidirectional && editModal.data.connects_to_node_id) {
                let targetNode = null;
                fullGraph.forEach(b => b.floors.forEach(f => f.nodes.forEach(n => {
                    if (n.id === editModal.data.connects_to_node_id) targetNode = n;
                })));

                if (targetNode) {
                    await updateNode(targetNode.id, {
                        connects_to_node_id: editModal.data.id,
                        connects_to_floor_id: selectedFloor.id,
                        connects_to_building_id: selectedBuilding.id
                    });
                    alert(`Bidirectional link created: ${targetNode.name} now connects back to this node.`);
                }
            }

            setNodes(nodes.map(n => n.id === editModal.data.id ? { ...n, ...editModal.data } : n));
            setEditModal(null);
            setCreateBidirectional(false);
        } catch (e) { alert(e.message); }
    }

    async function handleNodeDelete() {
        if (!editModal) return;
        try {
            await deleteNode(editModal.data.id);
            setNodes(nodes.filter(n => n.id !== editModal.data.id));
            setEdges(edges.filter(e => e.from_node_id !== editModal.data.id && e.to_node_id !== editModal.data.id));
            setEditModal(null);
        } catch (e) { alert(e.message); }
    }

    async function handleEdgeUpdate() {
        if (!editModal) return;
        try {
            await updateEdge(editModal.data.id, editModal.data);
            setEdges(edges.map(e => e.id === editModal.data.id ? { ...e, ...editModal.data } : e));
            setEditModal(null);
        } catch (e) { alert(e.message); }
    }

    async function handleEdgeDelete() {
        if (!editModal) return;
        try {
            await deleteEdge(editModal.data.id);
            setEdges(edges.filter(e => e.id !== editModal.data.id));
            setEditModal(null);
        } catch (e) { alert(e.message); }
    }

    async function handleAddFloor(e) {
        e.preventDefault();
        if (!selectedBuilding) return;
        try {
            const fd = new FormData();
            fd.append('floor_number', newFloorNum);
            fd.append('name', newFloorName || `Floor ${newFloorNum}`);
            if (newFloorImage) fd.append('image', newFloorImage);
            await createFloor(selectedBuilding.id, fd);
            setShowFloorForm(false);
            loadFloors();
        } catch (e) { alert(e.message); }
    }

    const tools_list = [
        { key: 'select', icon: '🖱️', label: 'Select' },
        { key: 'node', icon: '📍', label: 'Add Node' },
        { key: 'edge', icon: '➡️', label: 'Add Edge' },
    ];

    const specialNodes = [
        { type: 'stairs', icon: '🪜', label: 'Staircase' },
        { type: 'elevator', icon: '🛗', label: 'Elevator' },
        { type: 'ramp', icon: '♿', label: 'Ramp' },
        { type: 'emergency_exit', icon: '🚨', label: 'Emergency Exit' },
        { type: 'restricted', icon: '⛔', label: 'Restricted Area' },
        { type: 'connector', icon: '🔗', label: 'Connector' },
        { type: 'outdoor', icon: '🌳', label: 'Outdoor / Exit' },
        { type: 'hidden', icon: '👁️', label: 'Hidden Node' },
    ];

    const cursorStyle = tool === 'node' ? 'crosshair' : tool === 'edge' ? 'crosshair' : dragging ? 'grabbing' : 'default';

    async function handleUpdateSettings(e) {
        e.preventDefault();
        try {
            const formData = new FormData();
            if (newMainMap) formData.append('main_map', newMainMap);
            await updateInstitution(institutionId, formData, true);
            alert('Settings updated!');
            setShowSettings(false);
            const inst = await getInstitution(institutionId);
            setInstitution(inst);
        } catch (err) {
            console.error(err);
            alert('Failed to update settings');
        }
    }

    return (
        <div className="page">
            <div className="editor-container">
                <div className="editor-toolbar">
                    <div style={{ marginBottom: 16 }}>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => navigate(`/institution`)}>
                            ← Back to Dashboard
                        </button>
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => setShowSettings(true)}>
                            ⚙️ Institution Settings
                        </button>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{institution?.name || 'Map Editor'}</h3>
                    </div>

                    {/* Building & Floor Selection */}
                    <div className="tool-section">
                        <h3>Building</h3>
                        <select className="form-select" value={selectedBuilding?.id || ''} onChange={e => setSelectedBuilding(buildings.find(b => b.id === e.target.value))}>
                            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div className="tool-section">
                        <h3>Floor</h3>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                            {floors.map(f => (
                                <button key={f.id} className={`floor-step ${selectedFloor?.id === f.id ? 'active' : ''}`}
                                    onClick={() => setSelectedFloor(f)}>
                                    F{f.floor_number}
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setShowFloorForm(true)}>+ Add Floor</button>
                    </div>

                    {/* Tools */}
                    <div className="tool-section">
                        <h3>Tools</h3>
                        <div className="tool-grid">
                            {tools_list.map(t => (
                                <button key={t.key} className={`tool-btn ${tool === t.key ? 'active' : ''}`}
                                    onClick={() => { setTool(t.key); setEdgeStart(null); }}>
                                    <span className="tool-icon">{t.icon}</span>{t.label}
                                </button>
                            ))}
                        </div>
                        {tool === 'select' && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                                Click a node to select. Drag to reposition. Double-click to edit.
                            </p>
                        )}
                    </div>

                    {/* Node Type Selection */}
                    {tool === 'node' && (
                        <div className="tool-section">
                            <h3>Node Type</h3>
                            <div style={{ marginBottom: 8 }}>
                                <button className={`tool-btn ${nodeType === 'normal' ? 'active' : ''}`} style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-start', gap: 8 }}
                                    onClick={() => setNodeType('normal')}>
                                    <span>📍</span> Normal Node
                                </button>
                            </div>
                            {specialNodes.map(s => (
                                <button key={s.type} className={`tool-btn ${nodeType === s.type ? 'active' : ''}`}
                                    style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-start', gap: 8, marginBottom: 4 }}
                                    onClick={() => { setNodeType(s.type); setTool('node'); }}>
                                    <span>{s.icon}</span> {s.label}
                                </button>
                            ))}
                            <div className="form-group" style={{ marginTop: 8 }}>
                                <label>Node Name</label>
                                <input className="form-input" value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder="e.g., Room 101" />
                            </div>
                        </div>
                    )}

                    {/* Edge Properties */}
                    {tool === 'edge' && (
                        <div className="tool-section">
                            <h3>Edge Properties</h3>
                            <div className="form-group"><label>Weight (distance)</label><input className="form-input" type="number" step="0.1" value={edgeWeight} onChange={e => setEdgeWeight(e.target.value)} /></div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" onChange={e => setEdgeProps({ ...edgeProps, is_stairs: e.target.checked })} /> Stairs
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" onChange={e => setEdgeProps({ ...edgeProps, is_elevator: e.target.checked })} /> Elevator
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" defaultChecked onChange={e => setEdgeProps({ ...edgeProps, is_wheelchair_accessible: e.target.checked })} /> Wheelchair Accessible
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" onChange={e => setEdgeProps({ ...edgeProps, is_restricted: e.target.checked })} /> Restricted
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                <input type="checkbox" onChange={e => setEdgeProps({ ...edgeProps, is_outdoor: e.target.checked })} /> Outdoor Connector
                            </label>
                            {edgeStart && <p style={{ color: 'var(--warning)', fontSize: '0.8125rem', marginTop: 10 }}>🔗 Click destination node to complete edge</p>}
                        </div>
                    )}

                    {/* View Controls */}
                    <div className="tool-section">
                        <h3>View</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={showGraph} onChange={e => setShowGraph(e.target.checked)} /> Show Graph Overlay
                        </label>
                    </div>

                    {/* Stats */}
                    <div className="tool-section">
                        <h3>Stats</h3>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <p>Nodes: {nodes.length}</p>
                            <p>Edges: {edges.length}</p>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                        onClick={() => navigate(`/map/${institutionId}`)}>
                        🧪 Test Navigation
                    </button>
                </div>

                <div className="editor-canvas" ref={containerRef}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => { setMousePos(null); if (dragging) handleMouseUp(); }}
                        onClick={handleCanvasClick}
                        onDoubleClick={handleCanvasDblClick}
                        style={{ display: 'block', cursor: cursorStyle }}
                    />
                </div>
            </div>

            {/* Edit Node Modal */}
            {editModal?.type === 'node' && (
                <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setEditModal(null)}>
                    <div className="modal">
                        <h2>{NODE_ICONS[editModal.data.node_type]} Edit Node</h2>
                        <div className="form-group"><label>Name</label><input className="form-input" value={editModal.data.name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })} /></div>
                        <div className="form-group"><label>Type</label>
                            <select className="form-select" value={editModal.data.node_type} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, node_type: e.target.value } })}>
                                <option value="normal">Normal</option><option value="hidden">Hidden</option><option value="connector">Connector</option>
                                <option value="stairs">Stairs</option><option value="elevator">Elevator</option><option value="ramp">Ramp</option>
                                <option value="emergency_exit">Emergency Exit</option><option value="restricted">Restricted</option>
                                <option value="outdoor">Outdoor</option>
                            </select>
                        </div>
                        {editModal.data.node_type === 'outdoor' && (
                            <div className="form-group" style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 4 }}>
                                <label>Link to Position</label>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Connect this outdoor node to a node in another building.</p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem' }}>Building</label>
                                        <select className="form-select"
                                            value={editModal.data.connects_to_building_id || ''}
                                            onChange={e => {
                                                const bId = e.target.value;
                                                setEditModal({
                                                    ...editModal,
                                                    data: {
                                                        ...editModal.data,
                                                        connects_to_building_id: bId,
                                                        connects_to_floor_id: '',
                                                        connects_to_node_id: ''
                                                    }
                                                });
                                            }}>
                                            <option value="">Select Building</option>
                                            {fullGraph.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem' }}>Floor</label>
                                        <select className="form-select"
                                            disabled={!editModal.data.connects_to_building_id}
                                            value={editModal.data.connects_to_floor_id || ''}
                                            onChange={e => {
                                                const fId = e.target.value;
                                                setEditModal({
                                                    ...editModal,
                                                    data: {
                                                        ...editModal.data,
                                                        connects_to_floor_id: fId,
                                                        connects_to_node_id: ''
                                                    }
                                                });
                                            }}>
                                            <option value="">Select Floor</option>
                                            {fullGraph.find(b => b.id === editModal.data.connects_to_building_id)?.floors.map(f => (
                                                <option key={f.id} value={f.id}>F{f.floor_number} - {f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem' }}>Target Node</label>
                                    <select className="form-select"
                                        disabled={!editModal.data.connects_to_floor_id}
                                        value={editModal.data.connects_to_node_id || ''}
                                        onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, connects_to_node_id: e.target.value } })}>
                                        <option value="">Select Node</option>
                                        {fullGraph.find(b => b.id === editModal.data.connects_to_building_id)
                                            ?.floors.find(f => f.id === editModal.data.connects_to_floor_id)
                                            ?.nodes.filter(n => n.node_type !== 'hidden')
                                            .map(n => <option key={n.id} value={n.id}>{n.name} ({n.node_type})</option>)}
                                    </select>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', marginTop: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={createBidirectional} onChange={e => setCreateBidirectional(e.target.checked)} />
                                        Auto-link target node back to this node
                                    </label>
                                </div>
                            </div>
                        )}
                        <div className="form-group"><label>Description</label><textarea className="form-textarea" value={editModal.data.description || ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, description: e.target.value } })} /></div>
                        <div className="form-group"><label>Position</label>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>X: {editModal.data.x?.toFixed(4)} | Y: {editModal.data.y?.toFixed(4)}</p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-danger" onClick={handleNodeDelete}>🗑️ Delete</button>
                            <button className="btn btn-secondary" onClick={() => { setEditModal(null); setCreateBidirectional(false); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleNodeUpdate}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Edge Modal */}
            {editModal?.type === 'edge' && (
                <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setEditModal(null)}>
                    <div className="modal">
                        <h2>➡️ Edit Edge</h2>
                        <div className="form-group"><label>Weight</label><input className="form-input" type="number" step="0.1" value={editModal.data.weight} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, weight: parseFloat(e.target.value) } })} /></div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={!!editModal.data.is_stairs} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, is_stairs: e.target.checked } })} /> Stairs</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={!!editModal.data.is_elevator} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, is_elevator: e.target.checked } })} /> Elevator</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={editModal.data.is_wheelchair_accessible !== 0} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, is_wheelchair_accessible: e.target.checked } })} /> Wheelchair Accessible</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><input type="checkbox" checked={!!editModal.data.is_restricted} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, is_restricted: e.target.checked } })} /> Restricted</label>
                        <div className="form-group"><label>Crowd Level (0-10)</label><input className="form-input" type="number" min="0" max="10" value={editModal.data.crowd_level || 0} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, crowd_level: parseInt(e.target.value) } })} /></div>
                        <div className="modal-actions">
                            <button className="btn btn-danger" onClick={handleEdgeDelete}>🗑️ Delete</button>
                            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleEdgeUpdate}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Floor Modal */}
            {showFloorForm && (
                <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setShowFloorForm(false)}>
                    <div className="modal">
                        <h2>🏗️ Add Floor</h2>
                        <form onSubmit={handleAddFloor}>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Floor Number</label><input className="form-input" type="number" value={newFloorNum} onChange={e => setNewFloorNum(e.target.value)} /></div>
                                <div className="form-group"><label>Floor Name</label><input className="form-input" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="e.g., Ground Floor" /></div>
                            </div>
                            <div className="form-group"><label>Floor Plan Image</label><input type="file" accept="image/*" className="form-input" onChange={e => setNewFloorImage(e.target.files[0])} /></div>
                            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowFloorForm(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Floor</button></div>
                        </form>
                    </div>
                </div>
            )}
            {/* Institution Settings Modal */}
            {showSettings && (
                <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setShowSettings(false)}>
                    <div className="modal">
                        <h2>⚙️ Institution Settings</h2>
                        <form onSubmit={handleUpdateSettings}>
                            <div className="form-group">
                                <label>Main Map (Overview)</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Upload a high-level map of the entire institution. This will be shown first to visitors.
                                </p>
                                <input type="file" accept="image/*" className="form-input" onChange={e => setNewMainMap(e.target.files[0])} />
                            </div>
                            {institution?.main_map_url && (
                                <div style={{ marginBottom: 12 }}>
                                    <p style={{ fontSize: '0.8rem' }}>Current Map:</p>
                                    <img src={`http://localhost:3001${institution.main_map_url}`} style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)' }} />
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

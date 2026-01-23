import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { BrainMapNode, BrainMapConnection, NodeSize, NodeShape } from '../types';

interface BrainMapCanvasProps {
  nodes: BrainMapNode[];
  connections: BrainMapConnection[];
  centerNodeId?: string;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  isAddingNode: boolean;
  isConnecting: boolean;
  connectFromNodeId: string | null;
  showMinimap: boolean;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onCanvasClick: (x: number, y: number) => void;
  onNodeLabelChange: (nodeId: string, label: string) => void;
  onConnectionDelete: (connectionId: string) => void;
}

// Yeezy-inspired neutral palette
const PALETTE = {
  bg: '#0a0a0a',
  surface: '#141414',
  elevated: '#1a1a1a',
  text: '#F5F5F0',
  secondary: '#8A8A8A',
  muted: '#5A5A5A',
  divider: 'rgba(255, 255, 255, 0.08)',
  accent: '#E5E5E0',
};

// 3D Size configurations with depth
const SIZE_CONFIG: Record<NodeSize, { radius: number; fontSize: number; strokeWidth: number; depth: number }> = {
  small: { radius: 28, fontSize: 11, strokeWidth: 1, depth: 0.7 },
  medium: { radius: 42, fontSize: 13, strokeWidth: 1.5, depth: 0.85 },
  large: { radius: 58, fontSize: 15, strokeWidth: 2, depth: 1 },
  xl: { radius: 80, fontSize: 18, strokeWidth: 2.5, depth: 1.15 },
};

// Shape path generators
const getShapePath = (shape: NodeShape, radius: number): string => {
  switch (shape) {
    case 'diamond':
      return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
    case 'rectangle':
      const w = radius * 1.6;
      const h = radius * 1.1;
      return `M ${-w} ${-h} L ${w} ${-h} L ${w} ${h} L ${-w} ${h} Z`;
    case 'hexagon':
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        hex.push(`${i === 0 ? 'M' : 'L'} ${Math.cos(angle) * radius} ${Math.sin(angle) * radius}`);
      }
      return hex.join(' ') + ' Z';
    case 'pill':
      const pw = radius * 1.8;
      const ph = radius * 0.7;
      return `M ${-pw + ph} ${-ph} L ${pw - ph} ${-ph} A ${ph} ${ph} 0 0 1 ${pw - ph} ${ph} L ${-pw + ph} ${ph} A ${ph} ${ph} 0 0 1 ${-pw + ph} ${-ph} Z`;
    case 'circle':
    default:
      return '';
  }
};

// Animation spring physics
const SPRING_STIFFNESS = 0.1;
const SPRING_DAMPING = 0.82;

// Subtle grid dots
const generateGridDots = (count: number) => {
  const dots = [];
  for (let i = 0; i < count; i++) {
    dots.push({
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.15 + 0.05,
    });
  }
  return dots;
};

export default function BrainMapCanvas({
  nodes,
  connections,
  centerNodeId,
  selectedNodeId,
  editingNodeId,
  isAddingNode,
  isConnecting,
  connectFromNodeId,
  showMinimap,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDrag,
  onCanvasClick,
  onNodeLabelChange,
  onConnectionDelete,
}: BrainMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport state
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  // Animated positions
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, { x: number; y: number; vx: number; vy: number }>>(
    new Map()
  );

  // Background dots (memoized)
  const gridDots = useMemo(() => generateGridDots(80), []);

  // Subtle floating animation
  const [floatTime, setFloatTime] = useState(0);

  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setFloatTime(t => t + 0.015);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Center viewport on center node
  useEffect(() => {
    if (centerNodeId && nodes.length > 0) {
      const centerNode = nodes.find((n) => n.id === centerNodeId);
      if (centerNode) {
        setViewport((v) => ({
          ...v,
          x: dimensions.width / 2 - centerNode.x,
          y: dimensions.height / 2 - centerNode.y,
        }));
      }
    }
  }, [centerNodeId, nodes.length > 0, dimensions.width, dimensions.height]);

  // Initialize and update animated positions
  useEffect(() => {
    const newPositions = new Map(animatedPositions);
    let hasChanges = false;

    nodes.forEach((node) => {
      if (!newPositions.has(node.id)) {
        newPositions.set(node.id, { x: node.x, y: node.y, vx: 0, vy: 0 });
        hasChanges = true;
      }
    });

    newPositions.forEach((_, id) => {
      if (!nodes.find((n) => n.id === id)) {
        newPositions.delete(id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setAnimatedPositions(newPositions);
    }
  }, [nodes]);

  // Animation loop for smooth movement
  useEffect(() => {
    let animationFrameId: number;
    let isAnimating = false;

    const animate = () => {
      setAnimatedPositions((prev) => {
        const next = new Map(prev);
        let needsUpdate = false;

        nodes.forEach((node) => {
          const pos = next.get(node.id);
          if (!pos) return;

          if (draggingNodeId === node.id) {
            next.set(node.id, { ...pos, x: node.x, y: node.y, vx: 0, vy: 0 });
            return;
          }

          const dx = node.x - pos.x;
          const dy = node.y - pos.y;

          const ax = dx * SPRING_STIFFNESS;
          const ay = dy * SPRING_STIFFNESS;

          let vx = (pos.vx + ax) * SPRING_DAMPING;
          let vy = (pos.vy + ay) * SPRING_DAMPING;

          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
            next.set(node.id, { x: node.x, y: node.y, vx: 0, vy: 0 });
          } else {
            next.set(node.id, { x: pos.x + vx, y: pos.y + vy, vx, vy });
            needsUpdate = true;
          }
        });

        if (needsUpdate && !isAnimating) {
          isAnimating = true;
          animationFrameId = requestAnimationFrame(animate);
        } else {
          isAnimating = false;
        }

        return next;
      });
    };

    animate();
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, draggingNodeId]);

  // Get animated position
  const getNodePosition = useCallback(
    (node: BrainMapNode) => {
      const pos = animatedPositions.get(node.id);
      return pos ? { x: pos.x, y: pos.y } : { x: node.x, y: node.y };
    },
    [animatedPositions]
  );

  // Screen to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // FIXED: Mouse handlers - LEFT CLICK ON CANVAS PANS
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Left click on SVG background = pan, or middle click anywhere, or Alt+left click
      if (e.button === 0 || e.button === 1) {
        // Start panning
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
        e.preventDefault();
      }
    },
    [viewport]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && !draggingNodeId) {
        // Pan the viewport
        setViewport((v) => ({ ...v, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
      } else if (draggingNodeId) {
        // Drag the node
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const newX = canvasPos.x - dragOffset.x;
        const newY = canvasPos.y - dragOffset.y;
        setAnimatedPositions((prev) => {
          const next = new Map(prev);
          const pos = next.get(draggingNodeId);
          if (pos) next.set(draggingNodeId, { ...pos, x: newX, y: newY });
          return next;
        });
      }
    },
    [isPanning, panStart, draggingNodeId, dragOffset, screenToCanvas]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) setIsPanning(false);
      if (draggingNodeId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        onNodeDrag(draggingNodeId, canvasPos.x - dragOffset.x, canvasPos.y - dragOffset.y);
        setDraggingNodeId(null);
      }
    },
    [isPanning, draggingNodeId, dragOffset, screenToCanvas, onNodeDrag]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((v) => {
      const newZoom = Math.max(0.15, Math.min(3, v.zoom * delta));
      const zoomRatio = newZoom / v.zoom;
      return {
        x: mouseX - (mouseX - v.x) * zoomRatio,
        y: mouseY - (mouseY - v.y) * zoomRatio,
        zoom: newZoom,
      };
    });
  }, []);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: BrainMapNode) => {
      if (e.button === 0) {
        e.stopPropagation();
        setIsPanning(false); // Stop panning when clicking a node
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const pos = getNodePosition(node);
        setDraggingNodeId(node.id);
        setDragOffset({ x: canvasPos.x - pos.x, y: canvasPos.y - pos.y });
      }
    },
    [screenToCanvas, getNodePosition]
  );

  const handleCanvasClickInternal = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning && !draggingNodeId && e.target === svgRef.current && (isAddingNode || isConnecting)) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        onCanvasClick(canvasPos.x, canvasPos.y);
      }
    },
    [isPanning, draggingNodeId, screenToCanvas, onCanvasClick, isAddingNode, isConnecting]
  );

  // Build parent connections
  const parentConnections = useMemo(() => {
    return nodes
      .filter((n) => n.parent_node_id)
      .map((n) => ({
        id: `parent-${n.id}`,
        sourceId: n.parent_node_id!,
        targetId: n.id,
        isParentConnection: true,
      }));
  }, [nodes]);

  // Get node config
  const getNodeConfig = (node: BrainMapNode) => {
    const size = (node.size as NodeSize) || 'medium';
    return SIZE_CONFIG[size];
  };

  // Render elegant connection
  const renderConnection = (
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    color: string,
    isAnimated: boolean,
    isHovered: boolean,
    opacity: number = 1
  ) => {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return null;

    // Subtle bezier curve
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const curveOffset = Math.min(dist * 0.1, 30);
    const cpX = midX + perpX * curveOffset;
    const cpY = midY + perpY * curveOffset;

    const path = `M ${sourcePos.x} ${sourcePos.y} Q ${cpX} ${cpY} ${targetPos.x} ${targetPos.y}`;

    return (
      <g className="connection-line">
        {/* Subtle shadow */}
        <path
          d={path}
          fill="none"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={isHovered ? 4 : 2}
          strokeLinecap="round"
          transform="translate(1, 2)"
          style={{ filter: 'blur(2px)' }}
        />
        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={isHovered ? 2.5 : 1.5}
          strokeOpacity={0.6 * opacity}
          strokeLinecap="round"
          className={isAnimated ? 'connection-flow' : ''}
        />
        {/* Highlight */}
        <path
          d={path}
          fill="none"
          stroke={PALETTE.text}
          strokeWidth={isHovered ? 1.5 : 0.5}
          strokeOpacity={0.3 * opacity}
          strokeLinecap="round"
        />
      </g>
    );
  };

  // Render 3D node - Yeezy style
  const renderNode = (node: BrainMapNode, index: number) => {
    const pos = getNodePosition(node);
    const config = getNodeConfig(node);
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;
    const isDragging = node.id === draggingNodeId;
    const isConnectSource = node.id === connectFromNodeId;
    const isCenter = node.id === centerNodeId;
    const isEditing = node.id === editingNodeId;
    const shape = (node.shape as NodeShape) || 'circle';

    // Use node color or default to neutral
    const nodeColor = node.color || PALETTE.muted;

    // Subtle floating effect
    const floatOffset = Math.sin(floatTime + index * 0.3) * 2;
    const scale = isDragging ? 1.08 : isHovered ? 1.04 : isSelected ? 1.02 : 1;

    // Unique IDs for filters
    const shadowId = `shadow-${node.id}`;
    const gradientId = `grad-${node.id}`;

    // Generate shape path or use circle
    const shapePath = getShapePath(shape, config.radius);
    const useCircle = shape === 'circle';

    return (
      <g
        key={node.id}
        transform={`translate(${pos.x}, ${pos.y + floatOffset}) scale(${scale})`}
        className={`node-3d ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => handleNodeMouseDown(e, node)}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); onNodeDoubleClick(node.id); }}
      >
        {/* Definitions */}
        <defs>
          {/* Drop shadow */}
          <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
          </filter>
          {/* Subtle gradient */}
          <radialGradient id={gradientId} cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor={PALETTE.elevated} stopOpacity="1" />
            <stop offset="70%" stopColor={PALETTE.surface} stopOpacity="1" />
            <stop offset="100%" stopColor={PALETTE.bg} stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Connection indicator */}
        {isConnectSource && (
          <circle
            r={config.radius + 20}
            fill="none"
            stroke={PALETTE.text}
            strokeWidth={1.5}
            strokeDasharray="8 4"
            className="pulse-ring"
            opacity={0.5}
          />
        )}

        {/* Center node aura */}
        {isCenter && (
          <>
            <circle r={config.radius + 35} fill={nodeColor} opacity={0.04} className="aura-outer" />
            <circle r={config.radius + 20} fill={nodeColor} opacity={0.08} className="aura-mid" />
          </>
        )}

        {/* Selection ring */}
        {isSelected && !isConnectSource && (
          <circle
            r={config.radius + 8}
            fill="none"
            stroke={PALETTE.text}
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.4}
            className="selection-ring"
          />
        )}

        {/* Shadow */}
        {useCircle ? (
          <ellipse
            cx={2}
            cy={8}
            rx={config.radius * 0.85}
            ry={config.radius * 0.35}
            fill="rgba(0,0,0,0.25)"
            style={{ filter: 'blur(6px)' }}
          />
        ) : (
          <path
            d={shapePath}
            fill="rgba(0,0,0,0.2)"
            transform="translate(2, 6) scale(0.9)"
            style={{ filter: 'blur(5px)' }}
          />
        )}

        {/* Main shape */}
        {useCircle ? (
          <>
            {/* Base */}
            <circle
              r={config.radius}
              fill={`url(#${gradientId})`}
              stroke={isSelected ? PALETTE.text : PALETTE.divider}
              strokeWidth={config.strokeWidth}
              filter={`url(#${shadowId})`}
              className="node-body"
            />
            {/* Color accent ring */}
            <circle
              r={config.radius - 3}
              fill="none"
              stroke={nodeColor}
              strokeWidth={2}
              opacity={0.6}
            />
            {/* Top highlight */}
            <ellipse
              cx={-config.radius * 0.2}
              cy={-config.radius * 0.3}
              rx={config.radius * 0.4}
              ry={config.radius * 0.2}
              fill={PALETTE.text}
              opacity={0.08}
            />
          </>
        ) : (
          <>
            <path
              d={shapePath}
              fill={`url(#${gradientId})`}
              stroke={isSelected ? PALETTE.text : PALETTE.divider}
              strokeWidth={config.strokeWidth}
              filter={`url(#${shadowId})`}
              className="node-body"
            />
            {/* Color accent */}
            <path
              d={shapePath}
              fill="none"
              stroke={nodeColor}
              strokeWidth={2}
              opacity={0.5}
              transform="scale(0.92)"
            />
          </>
        )}

        {/* Label */}
        {isEditing ? (
          <foreignObject
            x={-config.radius * 1.8}
            y={-config.fontSize * 0.8}
            width={config.radius * 3.6}
            height={config.fontSize * 2.5}
          >
            <input
              type="text"
              defaultValue={node.label}
              className="node-edit-input"
              autoFocus
              onBlur={(e) => onNodeLabelChange(node.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onNodeLabelChange(node.id, (e.target as HTMLInputElement).value);
                if (e.key === 'Escape') onNodeLabelChange(node.id, node.label);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: config.fontSize,
                width: '100%',
                textAlign: 'center',
                background: PALETTE.surface,
                border: `1px solid ${PALETTE.divider}`,
                borderRadius: 6,
                color: PALETTE.text,
                padding: '6px 10px',
                outline: 'none',
                fontWeight: 300,
                letterSpacing: '0.5px',
              }}
            />
          </foreignObject>
        ) : (
          <>
            {/* Text shadow */}
            <text
              textAnchor="middle"
              dy="0.35em"
              fontSize={config.fontSize}
              fontWeight={isCenter ? 500 : 300}
              fill="rgba(0,0,0,0.4)"
              x={0.5}
              y={0.5}
              style={{ pointerEvents: 'none', letterSpacing: '0.3px' }}
            >
              {node.label.length > 16 ? node.label.substring(0, 14) + '…' : node.label}
            </text>
            {/* Main text */}
            <text
              textAnchor="middle"
              dy="0.35em"
              fontSize={config.fontSize}
              fontWeight={isCenter ? 500 : 300}
              fill={PALETTE.text}
              style={{ pointerEvents: 'none', letterSpacing: '0.3px' }}
            >
              {node.label.length > 16 ? node.label.substring(0, 14) + '…' : node.label}
            </text>
          </>
        )}

        {/* Linked indicator */}
        {(node.linked_note_id || node.linked_folder_id || node.linked_event_id) && (
          <g transform={`translate(${config.radius * 0.6}, ${-config.radius * 0.6})`}>
            <circle r={8} fill={PALETTE.surface} stroke={PALETTE.divider} strokeWidth={1} />
            <text textAnchor="middle" dy="0.35em" fontSize={9} fill={PALETTE.text}>
              {node.linked_event_id ? '◉' : '↗'}
            </text>
          </g>
        )}

        {/* Child count badge */}
        {nodes.filter((n) => n.parent_node_id === node.id).length > 0 && (
          <g transform={`translate(${config.radius * 0.65}, ${config.radius * 0.55})`}>
            <circle r={10} fill={PALETTE.surface} stroke={PALETTE.divider} strokeWidth={1} />
            <text textAnchor="middle" dy="0.35em" fontSize={9} fill={PALETTE.secondary} fontWeight={500}>
              {nodes.filter((n) => n.parent_node_id === node.id).length}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Minimap data
  const minimapData = useMemo(() => {
    if (nodes.length === 0) return null;
    const padding = 30;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      const config = getNodeConfig(node);
      minX = Math.min(minX, node.x - config.radius);
      minY = Math.min(minY, node.y - config.radius);
      maxX = Math.max(maxX, node.x + config.radius);
      maxY = Math.max(maxY, node.y + config.radius);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const scale = Math.min(160 / width, 110 / height);

    return { minX: minX - padding, minY: minY - padding, width, height, scale };
  }, [nodes]);

  return (
    <div
      ref={containerRef}
      className={`brain-map-canvas-yeezy ${isAddingNode ? 'adding-mode' : ''} ${isConnecting ? 'connecting-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleCanvasClickInternal}
        className="canvas-svg"
      >
        {/* Clean dark background */}
        <rect width="100%" height="100%" fill={PALETTE.bg} />

        {/* Subtle grid dots */}
        <g className="grid-dots" transform={`translate(${viewport.x * 0.2}, ${viewport.y * 0.2})`}>
          {gridDots.map((dot, i) => (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={dot.size}
              fill={PALETTE.muted}
              opacity={dot.opacity}
            />
          ))}
        </g>

        {/* Main content with viewport transform */}
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Parent connections */}
          {parentConnections.map(({ id, sourceId, targetId }) => {
            const sourceNode = nodes.find((n) => n.id === sourceId);
            const targetNode = nodes.find((n) => n.id === targetId);
            if (!sourceNode || !targetNode) return null;

            const sourcePos = getNodePosition(sourceNode);
            const targetPos = getNodePosition(targetNode);
            const color = targetNode.color || PALETTE.muted;

            return (
              <g key={id} opacity={0.6}>
                {renderConnection(sourcePos, targetPos, color, false, false, 0.5)}
              </g>
            );
          })}

          {/* Custom connections */}
          {connections.map((conn) => {
            const sourceNode = nodes.find((n) => n.id === conn.source_node_id);
            const targetNode = nodes.find((n) => n.id === conn.target_node_id);
            if (!sourceNode || !targetNode) return null;

            const sourcePos = getNodePosition(sourceNode);
            const targetPos = getNodePosition(targetNode);
            const isHovered = conn.id === hoveredConnectionId;
            const color = conn.color || PALETTE.secondary;

            return (
              <g
                key={conn.id}
                onMouseEnter={() => setHoveredConnectionId(conn.id)}
                onMouseLeave={() => setHoveredConnectionId(null)}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this connection?')) {
                    onConnectionDelete(conn.id);
                  }
                }}
              >
                {renderConnection(sourcePos, targetPos, color, conn.animated, isHovered)}
                {conn.label && (
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 12}
                    textAnchor="middle"
                    fontSize={11}
                    fill={PALETTE.secondary}
                    fontWeight={300}
                    letterSpacing="0.5px"
                    style={{ pointerEvents: 'none' }}
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes - sorted by layer */}
          {[...nodes]
            .sort((a, b) => a.layer - b.layer)
            .map((node, index) => renderNode(node, index))}

          {/* Connection preview */}
          {isConnecting && connectFromNodeId && hoveredNodeId && hoveredNodeId !== connectFromNodeId && (() => {
            const sourceNode = nodes.find((n) => n.id === connectFromNodeId);
            const targetNode = nodes.find((n) => n.id === hoveredNodeId);
            if (!sourceNode || !targetNode) return null;

            const sourcePos = getNodePosition(sourceNode);
            const targetPos = getNodePosition(targetNode);

            return (
              <g opacity={0.5}>
                {renderConnection(sourcePos, targetPos, PALETTE.text, true, false)}
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Minimap */}
      {showMinimap && minimapData && (
        <div className="brain-map-minimap-yeezy">
          <svg width={minimapData.width * minimapData.scale} height={minimapData.height * minimapData.scale}>
            {nodes.map((node) => {
              const config = getNodeConfig(node);
              return (
                <circle
                  key={node.id}
                  cx={(node.x - minimapData.minX) * minimapData.scale}
                  cy={(node.y - minimapData.minY) * minimapData.scale}
                  r={Math.max(3, config.radius * minimapData.scale * 0.5)}
                  fill={node.color || PALETTE.muted}
                  opacity={node.id === selectedNodeId ? 1 : 0.5}
                />
              );
            })}
            <rect
              x={(-viewport.x / viewport.zoom - minimapData.minX) * minimapData.scale}
              y={(-viewport.y / viewport.zoom - minimapData.minY) * minimapData.scale}
              width={(dimensions.width / viewport.zoom) * minimapData.scale}
              height={(dimensions.height / viewport.zoom) * minimapData.scale}
              fill="rgba(255,255,255,0.05)"
              stroke={PALETTE.divider}
              strokeWidth={1}
              rx={2}
            />
          </svg>
        </div>
      )}

      {/* Zoom controls */}
      <div className="brain-map-zoom-yeezy">
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.25) }))}>+</button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.15, v.zoom / 1.25) }))}>−</button>
        <button
          onClick={() => {
            if (centerNodeId) {
              const centerNode = nodes.find((n) => n.id === centerNodeId);
              if (centerNode) {
                setViewport({
                  x: dimensions.width / 2 - centerNode.x,
                  y: dimensions.height / 2 - centerNode.y,
                  zoom: 1,
                });
              }
            } else if (nodes.length > 0) {
              const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
              const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
              setViewport({
                x: dimensions.width / 2 - avgX,
                y: dimensions.height / 2 - avgY,
                zoom: 1,
              });
            }
          }}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { BrainMapNode, BrainMapConnection, NodeSize } from '../types';

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

// Size configurations
const SIZE_CONFIG: Record<NodeSize, { radius: number; fontSize: number; strokeWidth: number }> = {
  small: { radius: 24, fontSize: 11, strokeWidth: 2 },
  medium: { radius: 36, fontSize: 13, strokeWidth: 2.5 },
  large: { radius: 52, fontSize: 16, strokeWidth: 3 },
  xl: { radius: 72, fontSize: 20, strokeWidth: 4 },
};

// Animation spring physics
const SPRING_STIFFNESS = 0.08;
const SPRING_DAMPING = 0.85;

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

  // Animated positions for smooth movement
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, { x: number; y: number; vx: number; vy: number }>>(
    new Map()
  );

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

  // Center viewport on center node initially
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

  // Initialize and animate positions
  useEffect(() => {
    const newPositions = new Map(animatedPositions);
    let hasChanges = false;

    nodes.forEach((node) => {
      if (!newPositions.has(node.id)) {
        newPositions.set(node.id, { x: node.x, y: node.y, vx: 0, vy: 0 });
        hasChanges = true;
      }
    });

    // Remove deleted nodes
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

  // Animation loop for smooth node movement
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

          // Skip if being dragged
          if (draggingNodeId === node.id) {
            next.set(node.id, { ...pos, x: node.x, y: node.y, vx: 0, vy: 0 });
            return;
          }

          const dx = node.x - pos.x;
          const dy = node.y - pos.y;

          // Spring physics
          const ax = dx * SPRING_STIFFNESS;
          const ay = dy * SPRING_STIFFNESS;

          let vx = (pos.vx + ax) * SPRING_DAMPING;
          let vy = (pos.vy + ay) * SPRING_DAMPING;

          // Stop if very close
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
            next.set(node.id, { x: node.x, y: node.y, vx: 0, vy: 0 });
          } else {
            next.set(node.id, {
              x: pos.x + vx,
              y: pos.y + vy,
              vx,
              vy,
            });
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
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [nodes, draggingNodeId]);

  // Get animated position for a node
  const getNodePosition = useCallback(
    (node: BrainMapNode) => {
      const pos = animatedPositions.get(node.id);
      return pos ? { x: pos.x, y: pos.y } : { x: node.x, y: node.y };
    },
    [animatedPositions]
  );

  // Convert screen coordinates to canvas coordinates
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

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle click or Alt+click for panning
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
        e.preventDefault();
      }
    },
    [viewport]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setViewport((v) => ({
          ...v,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
      } else if (draggingNodeId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const newX = canvasPos.x - dragOffset.x;
        const newY = canvasPos.y - dragOffset.y;

        // Update local animated position immediately for smooth dragging
        setAnimatedPositions((prev) => {
          const next = new Map(prev);
          const pos = next.get(draggingNodeId);
          if (pos) {
            next.set(draggingNodeId, { ...pos, x: newX, y: newY });
          }
          return next;
        });
      }
    },
    [isPanning, panStart, draggingNodeId, dragOffset, screenToCanvas]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
      }
      if (draggingNodeId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const newX = canvasPos.x - dragOffset.x;
        const newY = canvasPos.y - dragOffset.y;
        onNodeDrag(draggingNodeId, newX, newY);
        setDraggingNodeId(null);
      }
    },
    [isPanning, draggingNodeId, dragOffset, screenToCanvas, onNodeDrag]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((v) => {
      const newZoom = Math.max(0.1, Math.min(3, v.zoom * delta));
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
      if (e.button === 0 && !e.altKey) {
        e.stopPropagation();
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const pos = getNodePosition(node);
        setDraggingNodeId(node.id);
        setDragOffset({
          x: canvasPos.x - pos.x,
          y: canvasPos.y - pos.y,
        });
      }
    },
    [screenToCanvas, getNodePosition]
  );

  const handleCanvasClickInternal = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning && !draggingNodeId && e.target === svgRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        onCanvasClick(canvasPos.x, canvasPos.y);
      }
    },
    [isPanning, draggingNodeId, screenToCanvas, onCanvasClick]
  );

  // Build parent-child connections
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

  // Get node size config
  const getNodeConfig = (node: BrainMapNode) => {
    const size = (node.size as NodeSize) || 'medium';
    return SIZE_CONFIG[size];
  };

  // Render curved path between nodes
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

    // Bezier curve control points
    const curvature = 0.3;
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    // Perpendicular offset for curve
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const curveOffset = dist * curvature * 0.3;

    const cp1x = midX + perpX * curveOffset;
    const cp1y = midY + perpY * curveOffset;

    const path = `M ${sourcePos.x} ${sourcePos.y} Q ${cp1x} ${cp1y} ${targetPos.x} ${targetPos.y}`;

    return (
      <g>
        {/* Glow effect */}
        {isHovered && (
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeOpacity={0.2}
            strokeLinecap="round"
          />
        )}
        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={isHovered ? 3 : 2}
          strokeOpacity={opacity}
          strokeLinecap="round"
          className={isAnimated ? 'connection-animated' : ''}
        />
        {/* Flow particles for animated connections */}
        {isAnimated && (
          <circle r={3} fill={color}>
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
        )}
      </g>
    );
  };

  // Render a single node
  const renderNode = (node: BrainMapNode) => {
    const pos = getNodePosition(node);
    const config = getNodeConfig(node);
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;
    const isDragging = node.id === draggingNodeId;
    const isConnectSource = node.id === connectFromNodeId;
    const isCenter = node.id === centerNodeId;
    const isEditing = node.id === editingNodeId;

    const color = node.color || '#6366f1';
    const scale = isDragging ? 1.05 : isHovered ? 1.02 : 1;

    // Glow filter
    const glowId = `glow-${node.id}`;

    return (
      <g
        key={node.id}
        transform={`translate(${pos.x}, ${pos.y}) scale(${scale})`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', transition: 'transform 0.1s ease' }}
        onMouseDown={(e) => handleNodeMouseDown(e, node)}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={(e) => {
          e.stopPropagation();
          onNodeClick(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onNodeDoubleClick(node.id);
        }}
      >
        {/* Filters */}
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`grad-${node.id}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Selection ring */}
        {(isSelected || isConnectSource) && (
          <circle
            r={config.radius + 8}
            fill="none"
            stroke={isConnectSource ? '#22c55e' : color}
            strokeWidth={2}
            strokeDasharray={isConnectSource ? '8 4' : 'none'}
            opacity={0.6}
            className="selection-ring"
          />
        )}

        {/* Outer glow for center node */}
        {isCenter && (
          <circle
            r={config.radius + 20}
            fill={`url(#grad-${node.id})`}
            opacity={0.15}
            className="center-glow"
          />
        )}

        {/* Main circle */}
        <circle
          r={config.radius}
          fill={`url(#grad-${node.id})`}
          stroke={isSelected ? '#fff' : color}
          strokeWidth={config.strokeWidth}
          filter={isHovered || isSelected ? `url(#${glowId})` : undefined}
          style={{ transition: 'all 0.2s ease' }}
        />

        {/* Inner highlight */}
        <ellipse
          cx={-config.radius * 0.25}
          cy={-config.radius * 0.25}
          rx={config.radius * 0.4}
          ry={config.radius * 0.3}
          fill="#fff"
          opacity={0.2}
        />

        {/* Label */}
        {isEditing ? (
          <foreignObject
            x={-config.radius * 1.5}
            y={-config.fontSize}
            width={config.radius * 3}
            height={config.fontSize * 2.5}
          >
            <input
              type="text"
              defaultValue={node.label}
              className="node-edit-input"
              autoFocus
              onBlur={(e) => onNodeLabelChange(node.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onNodeLabelChange(node.id, (e.target as HTMLInputElement).value);
                }
                if (e.key === 'Escape') {
                  onNodeLabelChange(node.id, node.label);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: config.fontSize,
                width: '100%',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                color: '#fff',
                padding: '4px 8px',
              }}
            />
          </foreignObject>
        ) : (
          <text
            textAnchor="middle"
            dy="0.35em"
            fontSize={config.fontSize}
            fontWeight={isCenter ? 600 : 500}
            fill="#fff"
            style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
          </text>
        )}

        {/* Linked indicator */}
        {(node.linked_note_id || node.linked_folder_id) && (
          <g transform={`translate(${config.radius * 0.7}, ${-config.radius * 0.7})`}>
            <circle r={8} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />
            <text textAnchor="middle" dy="0.35em" fontSize={10} fill="#fff">
              ↗
            </text>
          </g>
        )}

        {/* Child count indicator */}
        {nodes.filter((n) => n.parent_node_id === node.id).length > 0 && !node.is_collapsed && (
          <g transform={`translate(${config.radius * 0.7}, ${config.radius * 0.7})`}>
            <circle r={10} fill="rgba(0,0,0,0.6)" stroke="#fff" strokeWidth={1} />
            <text textAnchor="middle" dy="0.35em" fontSize={9} fill="#fff" fontWeight={600}>
              {nodes.filter((n) => n.parent_node_id === node.id).length}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Compute minimap data
  const minimapData = useMemo(() => {
    if (nodes.length === 0) return null;

    const padding = 20;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodes.forEach((node) => {
      const config = getNodeConfig(node);
      minX = Math.min(minX, node.x - config.radius);
      minY = Math.min(minY, node.y - config.radius);
      maxX = Math.max(maxX, node.x + config.radius);
      maxY = Math.max(maxY, node.y + config.radius);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const scale = Math.min(150 / width, 100 / height);

    return {
      minX: minX - padding,
      minY: minY - padding,
      width,
      height,
      scale,
    };
  }, [nodes]);

  return (
    <div
      ref={containerRef}
      className={`brain-map-canvas ${isAddingNode ? 'adding-mode' : ''} ${isConnecting ? 'connecting-mode' : ''}`}
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
        style={{ background: 'transparent' }}
      >
        {/* Background pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--border-color)" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Main content group with viewport transform */}
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Parent-child connections (hierarchical) */}
          {parentConnections.map(({ id, sourceId, targetId }) => {
            const sourceNode = nodes.find((n) => n.id === sourceId);
            const targetNode = nodes.find((n) => n.id === targetId);
            if (!sourceNode || !targetNode) return null;

            const sourcePos = getNodePosition(sourceNode);
            const targetPos = getNodePosition(targetNode);
            const color = targetNode.color || '#6366f1';

            return (
              <g key={id} opacity={0.6}>
                {renderConnection(sourcePos, targetPos, color, false, false, 0.4)}
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
            const color = conn.color || '#ec4899';

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
                    y={(sourcePos.y + targetPos.y) / 2 - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--text-secondary)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes - render in layer order */}
          {[...nodes]
            .sort((a, b) => a.layer - b.layer)
            .map((node) => renderNode(node))}

          {/* Connection preview line */}
          {isConnecting && connectFromNodeId && hoveredNodeId && hoveredNodeId !== connectFromNodeId && (
            (() => {
              const sourceNode = nodes.find((n) => n.id === connectFromNodeId);
              const targetNode = nodes.find((n) => n.id === hoveredNodeId);
              if (!sourceNode || !targetNode) return null;

              const sourcePos = getNodePosition(sourceNode);
              const targetPos = getNodePosition(targetNode);

              return (
                <g opacity={0.5}>
                  {renderConnection(sourcePos, targetPos, '#22c55e', true, false)}
                </g>
              );
            })()
          )}
        </g>
      </svg>

      {/* Minimap */}
      {showMinimap && minimapData && (
        <div className="brain-map-minimap">
          <svg width={minimapData.width * minimapData.scale} height={minimapData.height * minimapData.scale}>
            {/* Nodes */}
            {nodes.map((node) => {
              const config = getNodeConfig(node);
              return (
                <circle
                  key={node.id}
                  cx={(node.x - minimapData.minX) * minimapData.scale}
                  cy={(node.y - minimapData.minY) * minimapData.scale}
                  r={Math.max(3, config.radius * minimapData.scale * 0.5)}
                  fill={node.color || '#6366f1'}
                  opacity={node.id === selectedNodeId ? 1 : 0.6}
                />
              );
            })}
            {/* Viewport indicator */}
            <rect
              x={(-viewport.x / viewport.zoom - minimapData.minX) * minimapData.scale}
              y={(-viewport.y / viewport.zoom - minimapData.minY) * minimapData.scale}
              width={(dimensions.width / viewport.zoom) * minimapData.scale}
              height={(dimensions.height / viewport.zoom) * minimapData.scale}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              opacity={0.8}
            />
          </svg>
        </div>
      )}

      {/* Zoom controls */}
      <div className="brain-map-zoom-controls">
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))}>+</button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.1, v.zoom / 1.2) }))}>−</button>
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
            }
          }}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

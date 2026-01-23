import { useRef, useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { BrainMapNode, BrainMapConnection, NodeSize } from '../types';

// Check WebGL support
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

interface BrainMapCanvas3DProps {
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

// Size config for 3D
const SIZE_CONFIG: Record<NodeSize, { radius: number; fontSize: number }> = {
  small: { radius: 0.4, fontSize: 12 },
  medium: { radius: 0.6, fontSize: 14 },
  large: { radius: 0.85, fontSize: 16 },
  xl: { radius: 1.1, fontSize: 18 },
};

// Scale factor to convert 2D coords to 3D space
const SCALE = 0.02;

// Orb colors - muted, elegant
const ORB_COLORS = [
  '#4a4a4a', // dark gray
  '#5c5c5c', // medium gray
  '#3d4a4a', // dark teal
  '#4a3d3d', // dark brown
  '#3d3d4a', // dark blue-gray
  '#5a5a5a', // gray
  '#6b5b4b', // warm brown
  '#4b5b6b', // cool blue
  '#5b6b5b', // sage
  '#6b5b5b', // mauve
];

// Individual 3D Orb Node
function OrbNode({
  node,
  isSelected,
  isHovered,
  isCenter,
  isConnectSource,
  isEditing,
  childCount,
  hasLink,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
  onDoubleClick,
  onLabelChange,
}: {
  node: BrainMapNode;
  isSelected: boolean;
  isHovered: boolean;
  isCenter: boolean;
  isConnectSource: boolean;
  isEditing: boolean;
  childCount: number;
  hasLink: boolean;
  onPointerDown: (e: any) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onLabelChange: (label: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = (node.size as NodeSize) || 'medium';
  const config = SIZE_CONFIG[size];

  // Position in 3D space
  const position: [number, number, number] = [
    node.x * SCALE,
    node.y * SCALE * -1, // Flip Y for 3D
    0,
  ];

  // Get orb color - use node color or generate from id
  const orbColor = useMemo(() => {
    if (node.color) return node.color;
    const hash = node.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return ORB_COLORS[hash % ORB_COLORS.length];
  }, [node.id, node.color]);

  // Subtle floating animation
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.position.z = Math.sin(t * 0.5 + node.x * 0.01) * 0.1;
    }
  });

  // Scale based on state
  const scale = isSelected ? 1.15 : isHovered ? 1.08 : 1;

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.1}
      floatIntensity={0.3}
      floatingRange={[-0.05, 0.05]}
    >
      <group position={position}>
        {/* Main orb */}
        <mesh
          ref={meshRef}
          scale={scale}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        >
          <sphereGeometry args={[config.radius, 64, 64]} />
          <meshStandardMaterial
            color={orbColor}
            roughness={0.3}
            metalness={0.1}
            envMapIntensity={0.8}
          />
        </mesh>

        {/* Selection ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[config.radius + 0.15, 0.02, 16, 64]} />
            <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
          </mesh>
        )}

        {/* Connect source indicator */}
        {isConnectSource && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[config.radius + 0.25, 0.03, 16, 64]} />
            <meshBasicMaterial color="#88cc88" opacity={0.8} transparent />
          </mesh>
        )}

        {/* Center node glow */}
        {isCenter && (
          <mesh>
            <sphereGeometry args={[config.radius + 0.3, 32, 32]} />
            <meshBasicMaterial color={orbColor} opacity={0.1} transparent />
          </mesh>
        )}

        {/* Label */}
        <Html
          position={[0, -config.radius - 0.3, 0]}
          center
          style={{
            pointerEvents: isEditing ? 'auto' : 'none',
            userSelect: 'none',
          }}
        >
          {isEditing ? (
            <input
              type="text"
              defaultValue={node.label}
              autoFocus
              onBlur={(e) => onLabelChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLabelChange((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') onLabelChange(node.label);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(20, 20, 20, 0.95)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#F5F5F0',
                fontSize: config.fontSize,
                fontWeight: 300,
                letterSpacing: '0.5px',
                textAlign: 'center',
                outline: 'none',
                minWidth: 100,
              }}
            />
          ) : (
            <div
              style={{
                color: '#F5F5F0',
                fontSize: config.fontSize,
                fontWeight: isCenter ? 500 : 300,
                letterSpacing: '0.5px',
                textAlign: 'center',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                maxWidth: 150,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {node.label}
            </div>
          )}
        </Html>

        {/* Link indicator */}
        {hasLink && (
          <Html position={[config.radius * 0.7, config.radius * 0.7, 0]} center>
            <div
              style={{
                width: 16,
                height: 16,
                background: 'rgba(20, 20, 20, 0.9)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#F5F5F0',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {node.linked_event_id ? '◉' : '↗'}
            </div>
          </Html>
        )}

        {/* Child count badge */}
        {childCount > 0 && (
          <Html position={[config.radius * 0.7, -config.radius * 0.7, 0]} center>
            <div
              style={{
                width: 20,
                height: 20,
                background: 'rgba(20, 20, 20, 0.9)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 500,
                color: '#8A8A8A',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {childCount}
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// Connection line between orbs
function ConnectionLine({
  start,
  end,
  color,
  isHovered,
  onClick,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  isHovered: boolean;
  onClick: () => void;
}) {
  // Create curved line
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    0.3, // Curve up in Z
  ];

  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...end)
    );
  }, [start, end, mid]);

  const points = useMemo(() => curve.getPoints(32), [curve]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={isHovered ? 3 : 1.5}
      opacity={isHovered ? 0.8 : 0.4}
      transparent
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

// Camera controller for centering
function CameraController({ centerPosition }: { centerPosition?: [number, number, number] }) {
  const { camera } = useThree();

  useEffect(() => {
    if (centerPosition) {
      camera.position.set(centerPosition[0], centerPosition[1], 15);
      camera.lookAt(centerPosition[0], centerPosition[1], 0);
    }
  }, [centerPosition, camera]);

  return null;
}

// Main scene content
function Scene({
  nodes,
  connections,
  centerNodeId,
  selectedNodeId,
  editingNodeId,
  isConnecting: _isConnecting,
  connectFromNodeId,
  hoveredNodeId,
  hoveredConnectionId,
  setHoveredNodeId,
  setHoveredConnectionId: _setHoveredConnectionId,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDrag: _onNodeDrag,
  onNodeLabelChange,
  onConnectionDelete,
}: {
  nodes: BrainMapNode[];
  connections: BrainMapConnection[];
  centerNodeId?: string;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  isConnecting: boolean;
  connectFromNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredConnectionId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  setHoveredConnectionId: (id: string | null) => void;
  onNodeClick: (id: string) => void;
  onNodeDoubleClick: (id: string) => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
  onNodeLabelChange: (id: string, label: string) => void;
  onConnectionDelete: (id: string) => void;
}) {
  // Get center position for camera
  const centerPosition = useMemo((): [number, number, number] | undefined => {
    if (centerNodeId) {
      const centerNode = nodes.find((n) => n.id === centerNodeId);
      if (centerNode) {
        return [centerNode.x * SCALE, centerNode.y * SCALE * -1, 0];
      }
    }
    if (nodes.length > 0) {
      const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
      const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
      return [avgX * SCALE, avgY * SCALE * -1, 0];
    }
    return undefined;
  }, [centerNodeId, nodes]);

  // Build parent connections
  const parentConnections = useMemo(() => {
    return nodes
      .filter((n) => n.parent_node_id)
      .map((n) => ({
        id: `parent-${n.id}`,
        sourceId: n.parent_node_id!,
        targetId: n.id,
      }));
  }, [nodes]);

  // Get node position helper
  const getNodePos = useCallback((nodeId: string): [number, number, number] => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return [0, 0, 0];
    return [node.x * SCALE, node.y * SCALE * -1, 0];
  }, [nodes]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -10, 5]} intensity={0.3} />
      <pointLight position={[0, 0, 10]} intensity={0.5} />

      {/* Environment for reflections */}
      <Environment preset="city" />

      {/* Camera controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={50}
        panSpeed={1}
        rotateSpeed={0.5}
        zoomSpeed={1}
      />

      <CameraController centerPosition={centerPosition} />

      {/* Parent connections */}
      {parentConnections.map(({ id, sourceId, targetId }) => {
        const sourceNode = nodes.find((n) => n.id === sourceId);
        const targetNode = nodes.find((n) => n.id === targetId);
        if (!sourceNode || !targetNode) return null;

        return (
          <ConnectionLine
            key={id}
            start={getNodePos(sourceId)}
            end={getNodePos(targetId)}
            color={targetNode.color || '#5A5A5A'}
            isHovered={false}
            onClick={() => {}}
          />
        );
      })}

      {/* Custom connections */}
      {connections.map((conn) => {
        const sourceNode = nodes.find((n) => n.id === conn.source_node_id);
        const targetNode = nodes.find((n) => n.id === conn.target_node_id);
        if (!sourceNode || !targetNode) return null;

        return (
          <ConnectionLine
            key={conn.id}
            start={getNodePos(conn.source_node_id)}
            end={getNodePos(conn.target_node_id)}
            color={conn.color || '#8A8A8A'}
            isHovered={conn.id === hoveredConnectionId}
            onClick={() => {
              if (window.confirm('Delete this connection?')) {
                onConnectionDelete(conn.id);
              }
            }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const childCount = nodes.filter((n) => n.parent_node_id === node.id).length;
        const hasLink = !!(node.linked_note_id || node.linked_folder_id || node.linked_event_id);

        return (
          <OrbNode
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            isHovered={node.id === hoveredNodeId}
            isCenter={node.id === centerNodeId}
            isConnectSource={node.id === connectFromNodeId}
            isEditing={node.id === editingNodeId}
            childCount={childCount}
            hasLink={hasLink}
            onPointerDown={() => {}}
            onPointerOver={() => setHoveredNodeId(node.id)}
            onPointerOut={() => setHoveredNodeId(null)}
            onClick={() => onNodeClick(node.id)}
            onDoubleClick={() => onNodeDoubleClick(node.id)}
            onLabelChange={(label) => onNodeLabelChange(node.id, label)}
          />
        );
      })}
    </>
  );
}

// Main component
export default function BrainMapCanvas3D({
  nodes,
  connections,
  centerNodeId,
  selectedNodeId,
  editingNodeId,
  isAddingNode,
  isConnecting,
  connectFromNodeId,
  showMinimap: _showMinimap,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDrag,
  onCanvasClick,
  onNodeLabelChange,
  onConnectionDelete,
}: BrainMapCanvas3DProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  // Handle canvas click for adding nodes
  const handleCanvasClick = useCallback(
    (e: any) => {
      if (isAddingNode || isConnecting) {
        // Convert 3D click to 2D coords
        const point = e.point;
        onCanvasClick(point.x / SCALE, point.y / SCALE * -1);
      }
    },
    [isAddingNode, isConnecting, onCanvasClick]
  );

  // Check WebGL availability
  const [webglSupported, setWebglSupported] = useState(true);
  const [hasError, _setHasError] = useState(false);

  useEffect(() => {
    const supported = isWebGLAvailable();
    console.log('BrainMapCanvas3D mounted, WebGL supported:', supported, 'Nodes:', nodes.length);
    setWebglSupported(supported);
  }, [nodes.length]);

  if (!webglSupported || hasError) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8A8A8A',
          fontSize: 14,
        }}
      >
        {hasError ? 'Error loading 3D view' : 'WebGL not supported'}
      </div>
    );
  }

  return (
    <div
      className="brain-map-canvas-3d-container"
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: '500px',
        background: '#0a0a0a',
        cursor: isAddingNode ? 'crosshair' : isConnecting ? 'pointer' : 'grab',
      }}
    >
      <Suspense
        fallback={
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8A8A8A',
            fontSize: 14,
          }}>
            Loading 3D...
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0, 15], fov: 60 }}
          onPointerMissed={handleCanvasClick}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
          onCreated={() => console.log('Canvas created')}
        >
          <color attach="background" args={['#0a0a0a']} />
          <fog attach="fog" args={['#0a0a0a', 20, 60]} />

          <Scene
            nodes={nodes}
            connections={connections}
            centerNodeId={centerNodeId}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            isConnecting={isConnecting}
            connectFromNodeId={connectFromNodeId}
            hoveredNodeId={hoveredNodeId}
            hoveredConnectionId={hoveredConnectionId}
            setHoveredNodeId={setHoveredNodeId}
            setHoveredConnectionId={setHoveredConnectionId}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDrag={onNodeDrag}
            onNodeLabelChange={onNodeLabelChange}
            onConnectionDelete={onConnectionDelete}
          />
        </Canvas>
      </Suspense>

      {/* Zoom hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 28,
          background: 'rgba(20, 20, 20, 0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '12px 18px',
          color: '#8A8A8A',
          fontSize: 11,
          fontWeight: 300,
          letterSpacing: '0.5px',
        }}
      >
        Scroll to zoom • Drag to rotate • Right-click to pan
      </div>
    </div>
  );
}

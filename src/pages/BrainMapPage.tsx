import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  useBrainMaps,
  useBrainMap,
  useCreateBrainMap,
  useDeleteBrainMap,
  useCreateBrainMapNode,
  useUpdateBrainMapNode,
  useDeleteBrainMapNode,
  useUpdateNodePositions,
  useCreateBrainMapConnection,
  useDeleteBrainMapConnection,
  useUpdateBrainMap,
  useNotes,
} from '../queries';
import BrainMapCanvas from '../components/BrainMapCanvas';
import type { BrainMapNode } from '../types';

// Color palette for nodes
const NODE_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

// Golden angle for spiral positioning
const GOLDEN_ANGLE = 2.399963229728653;

export default function BrainMapPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { brainMapId?: string };
  const brainMapId = params.brainMapId ?? null;

  // State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMinimap, setShowMinimap] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: brainMaps = [], isLoading: mapsLoading } = useBrainMaps();
  const { data: currentMap, isLoading: mapLoading } = useBrainMap(brainMapId);
  const { data: notes = [] } = useNotes();
  const createMap = useCreateBrainMap();
  const deleteMap = useDeleteBrainMap();
  const updateMap = useUpdateBrainMap();
  const createNode = useCreateBrainMapNode();
  const updateNode = useUpdateBrainMapNode();
  const deleteNode = useDeleteBrainMapNode();
  const updatePositions = useUpdateNodePositions();
  const createConnection = useCreateBrainMapConnection();
  const deleteConnection = useDeleteBrainMapConnection();

  // Note search state for linking
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [showNoteLinkDropdown, setShowNoteLinkDropdown] = useState(false);

  // Check if viewing "all notes" mode
  const isAllNotesView = brainMapId === 'all';

  // Generate nodes from all notes for "Show All" view
  const allNotesData = useMemo(() => {
    if (!isAllNotesView) return null;

    const generatedNodes: BrainMapNode[] = notes.map((note, idx) => {
      // Position nodes in a spiral pattern using golden angle
      const angle = idx * GOLDEN_ANGLE;
      const radius = 60 + Math.sqrt(idx) * 50;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const color = NODE_COLORS[idx % NODE_COLORS.length];

      return {
        id: `note-${note.id}`,
        brain_map_id: 'all',
        parent_node_id: null,
        linked_note_id: note.id,
        label: note.title || 'Untitled',
        x,
        y,
        color,
        shape: 'circle' as const,
        size: 'medium' as const,
        is_collapsed: false,
        layer: 1,
        sort_order: idx,
        created_at: note.created_at,
        updated_at: note.updated_at,
      };
    });

    return {
      brain_map: {
        id: 'all',
        title: 'All Notes',
        description: 'Everything in one view',
        center_node_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      nodes: generatedNodes,
      connections: [],
    };
  }, [isAllNotesView, notes]);

  // Filter maps by search
  const filteredMaps = brainMaps.filter(
    (map) =>
      map.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (map.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Selected node data
  const selectedNode = currentMap?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Filter notes for linking - show all notes by default
  const filteredNotes = noteSearchQuery
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
      )
    : notes;

  // Get linked note for selected node
  const linkedNote = selectedNode?.linked_note_id
    ? notes.find((n) => n.id === selectedNode.linked_note_id)
    : null;

  // Handlers
  const handleCreateMap = async () => {
    const result = await createMap.mutateAsync({
      title: 'New Brain Map',
      center_node_text: 'Main Idea',
    });
    navigate({ to: '/brain-maps/$brainMapId', params: { brainMapId: result.brain_map.id } });
  };

  const handleSelectMap = (id: string) => {
    setSelectedNodeId(null);
    navigate({ to: '/brain-maps/$brainMapId', params: { brainMapId: id } });
  };

  const handleDeleteMap = async (id: string) => {
    if (window.confirm('Delete this brain map?')) {
      await deleteMap.mutateAsync({ id });
      if (brainMapId === id) {
        navigate({ to: '/brain-maps' });
      }
    }
  };

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (isConnecting && connectFromNodeId) {
        // Create connection
        if (connectFromNodeId !== nodeId && brainMapId) {
          createConnection.mutate({
            brain_map_id: brainMapId,
            source_node_id: connectFromNodeId,
            target_node_id: nodeId,
          });
        }
        setIsConnecting(false);
        setConnectFromNodeId(null);
      } else {
        setSelectedNodeId(nodeId);
      }
    },
    [isConnecting, connectFromNodeId, brainMapId, createConnection]
  );

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      if (isAddingNode && brainMapId) {
        // Create new node at clicked position
        const parentId = selectedNodeId;
        const color = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];
        const layer = parentId
          ? (currentMap?.nodes.find((n) => n.id === parentId)?.layer ?? 0) + 1
          : 1;

        createNode.mutate({
          brain_map_id: brainMapId,
          parent_node_id: parentId,
          label: 'New Idea',
          x,
          y,
          color,
          shape: layer === 0 ? 'circle' : layer === 1 ? 'pill' : 'circle',
          size: layer === 0 ? 'large' : layer === 1 ? 'medium' : 'small',
        });
        setIsAddingNode(false);
      } else {
        setSelectedNodeId(null);
      }
    },
    [isAddingNode, brainMapId, selectedNodeId, currentMap, createNode]
  );

  const handleNodeDrag = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (brainMapId) {
        updatePositions.mutate({
          updates: [[nodeId, x, y]],
          brainMapId,
        });
      }
    },
    [brainMapId, updatePositions]
  );

  const handleAddChildNode = () => {
    if (!selectedNodeId || !brainMapId) return;

    const parentNode = currentMap?.nodes.find((n) => n.id === selectedNodeId);
    if (!parentNode) return;

    // Calculate position for new child
    const siblings = currentMap?.nodes.filter((n) => n.parent_node_id === selectedNodeId) ?? [];
    const angle = (siblings.length * 45 * Math.PI) / 180;
    const distance = 180;
    const x = parentNode.x + Math.cos(angle) * distance;
    const y = parentNode.y + Math.sin(angle) * distance;

    const color = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];

    createNode.mutate({
      brain_map_id: brainMapId,
      parent_node_id: selectedNodeId,
      label: 'New Idea',
      x,
      y,
      color,
      shape: 'circle',
      size: 'medium',
    });
  };

  const handleUpdateNodeLabel = (nodeId: string, label: string) => {
    updateNode.mutate({ id: nodeId, data: { label } });
    setEditingNodeId(null);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId || !brainMapId) return;

    // Don't allow deleting center node
    if (currentMap?.brain_map.center_node_id === selectedNodeId) {
      alert("Can't delete the central node");
      return;
    }

    deleteNode.mutate({ id: selectedNodeId, brainMapId });
    setSelectedNodeId(null);
  };

  const handleStartConnecting = () => {
    if (selectedNodeId) {
      setIsConnecting(true);
      setConnectFromNodeId(selectedNodeId);
    }
  };

  const handleCancelConnecting = () => {
    setIsConnecting(false);
    setConnectFromNodeId(null);
  };

  const handleDeleteConnection = (connectionId: string) => {
    if (brainMapId) {
      deleteConnection.mutate({ id: connectionId, brainMapId });
    }
  };

  const handleUpdateNodeColor = (color: string) => {
    if (selectedNodeId) {
      updateNode.mutate({ id: selectedNodeId, data: { color } });
    }
  };

  // Auto-focus input when editing
  useEffect(() => {
    if (editingNodeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddingNode(false);
        setIsConnecting(false);
        setConnectFromNodeId(null);
        setEditingNodeId(null);
      }
      if (e.key === 'Delete' && selectedNodeId && !editingNodeId) {
        handleDeleteNode();
      }
      if (e.key === 'Tab' && selectedNodeId && !editingNodeId) {
        e.preventDefault();
        handleAddChildNode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId]);

  return (
    <div className="brain-map-page">
      {/* Sidebar */}
      <div className="brain-map-sidebar">
        <div className="brain-map-sidebar-header">
          <h2>Brain Maps</h2>
          <button className="btn-icon" onClick={handleCreateMap} title="New Map">
            +
          </button>
        </div>

        <div className="brain-map-search">
          <input
            type="text"
            placeholder="Search maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="brain-map-list">
          {/* Show All Notes Option */}
          <div
            className={`brain-map-show-all ${brainMapId === 'all' ? 'active' : ''}`}
            onClick={() => navigate({ to: '/brain-maps/$brainMapId', params: { brainMapId: 'all' } })}
          >
            <div className="brain-map-show-all-icon">◉</div>
            <div className="brain-map-show-all-content">
              <div className="brain-map-show-all-title">Show All</div>
              <div className="brain-map-show-all-sub">Everything in one view</div>
            </div>
            <span className="brain-map-show-all-arrow">→</span>
          </div>

          {mapsLoading ? (
            <div className="brain-map-list-empty">Loading...</div>
          ) : filteredMaps.length === 0 && searchQuery ? (
            <div className="brain-map-list-empty">
              No maps found
            </div>
          ) : filteredMaps.length === 0 ? (
            <div className="brain-map-list-empty">
              No brain maps yet
              <button onClick={handleCreateMap}>Create your first map</button>
            </div>
          ) : (
            filteredMaps.map((map) => (
              <div
                key={map.id}
                className={`brain-map-list-item ${brainMapId === map.id ? 'active' : ''}`}
                onClick={() => handleSelectMap(map.id)}
              >
                <div className="brain-map-list-item-icon">🧠</div>
                <div className="brain-map-list-item-content">
                  <div className="brain-map-list-item-title">{map.title}</div>
                  <div className="brain-map-list-item-meta">
                    {new Date(map.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="brain-map-list-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMap(map.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Node Inspector */}
        {selectedNode && (
          <div className="brain-map-inspector">
            <h3>Node Properties</h3>
            <div className="inspector-field">
              <label>Label</label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) =>
                  updateNode.mutate({ id: selectedNode.id, data: { label: e.target.value } })
                }
              />
            </div>
            <div className="inspector-field">
              <label>Color</label>
              <div className="color-picker">
                {NODE_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`color-swatch ${selectedNode.color === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleUpdateNodeColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="inspector-field">
              <label>Linked Note</label>
              {linkedNote ? (
                <div className="linked-note-display">
                  <span className="linked-note-title">{linkedNote.title || 'Untitled'}</span>
                  <div className="linked-note-actions">
                    <button
                      className="linked-note-btn"
                      onClick={() => navigate({ to: '/notes/$noteId', params: { noteId: linkedNote.id } })}
                      title="Open note"
                    >
                      Open
                    </button>
                    <button
                      className="linked-note-btn danger"
                      onClick={() => updateNode.mutate({ id: selectedNode.id, data: { linked_note_id: null } })}
                      title="Unlink note"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="note-link-selector">
                  <input
                    type="text"
                    placeholder="Search notes to link..."
                    value={noteSearchQuery}
                    onChange={(e) => {
                      setNoteSearchQuery(e.target.value);
                      setShowNoteLinkDropdown(true);
                    }}
                    onFocus={() => setShowNoteLinkDropdown(true)}
                  />
                  {showNoteLinkDropdown && (
                    <div className="note-link-dropdown">
                      <div className="note-link-dropdown-header">
                        {noteSearchQuery ? `RESULTS (${filteredNotes.length})` : `ALL NOTES (${notes.length})`}
                      </div>
                      {filteredNotes.length === 0 ? (
                        <div className="note-link-empty">
                          {noteSearchQuery ? 'No notes match your search' : 'No notes yet'}
                        </div>
                      ) : (
                        filteredNotes.map((note) => (
                          <button
                            key={note.id}
                            className="note-link-option"
                            onClick={() => {
                              updateNode.mutate({ id: selectedNode.id, data: { linked_note_id: note.id } });
                              setNoteSearchQuery('');
                              setShowNoteLinkDropdown(false);
                            }}
                          >
                            <span className="note-link-title">{note.title || 'Untitled'}</span>
                            <span className="note-link-preview">
                              {note.content.replace(/<[^>]*>/g, '').slice(0, 40)}...
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="inspector-actions">
              <button onClick={handleAddChildNode}>+ Add Child</button>
              <button onClick={handleStartConnecting}>⤵ Connect</button>
              <button className="danger" onClick={handleDeleteNode}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="brain-map-main">
        {!brainMapId ? (
          <div className="brain-map-empty">
            <div className="brain-map-empty-icon">🧠</div>
            <h2>Welcome to Brain Maps</h2>
            <p>Visualize your thoughts and ideas as an interconnected web.</p>
            <button className="btn-primary" onClick={handleCreateMap}>
              Create Your First Map
            </button>
          </div>
        ) : isAllNotesView ? (
          // All Notes View
          <>
            <div className="brain-map-toolbar">
              <div className="brain-map-title">
                <span className="brain-map-title-text">All Notes</span>
                <span className="brain-map-title-count">{notes.length} items</span>
              </div>
              <div className="brain-map-toolbar-actions">
                <button
                  className={`toolbar-btn ${showMinimap ? 'active' : ''}`}
                  onClick={() => setShowMinimap(!showMinimap)}
                >
                  Minimap
                </button>
              </div>
            </div>

            {allNotesData && allNotesData.nodes.length > 0 ? (
              <BrainMapCanvas
                nodes={allNotesData.nodes}
                connections={allNotesData.connections}
                selectedNodeId={selectedNodeId}
                editingNodeId={null}
                isAddingNode={false}
                isConnecting={false}
                connectFromNodeId={null}
                showMinimap={showMinimap}
                onNodeClick={(nodeId) => {
                  const node = allNotesData.nodes.find(n => n.id === nodeId);
                  if (node?.linked_note_id) {
                    navigate({ to: '/notes/$noteId', params: { noteId: node.linked_note_id } });
                  }
                }}
                onNodeDoubleClick={() => {}}
                onNodeDrag={() => {}}
                onCanvasClick={() => setSelectedNodeId(null)}
                onNodeLabelChange={() => {}}
                onConnectionDelete={() => {}}
              />
            ) : (
              <div className="brain-map-empty">
                <div className="brain-map-empty-icon">📝</div>
                <h2>No Notes Yet</h2>
                <p>Create some notes to see them visualized here.</p>
              </div>
            )}
          </>
        ) : mapLoading ? (
          <div className="brain-map-loading">
            <div className="loading-spinner" />
            <p>Loading brain map...</p>
          </div>
        ) : currentMap ? (
          <>
            {/* Toolbar */}
            <div className="brain-map-toolbar">
              <div className="brain-map-title">
                <input
                  type="text"
                  value={currentMap.brain_map.title}
                  onChange={(e) =>
                    updateMap.mutate({ id: currentMap.brain_map.id, data: { title: e.target.value } })
                  }
                />
              </div>
              <div className="brain-map-toolbar-actions">
                <button
                  className={`toolbar-btn ${isAddingNode ? 'active' : ''}`}
                  onClick={() => setIsAddingNode(!isAddingNode)}
                  title="Add Node (click on canvas)"
                >
                  + Add Node
                </button>
                {isConnecting && (
                  <button className="toolbar-btn cancel" onClick={handleCancelConnecting}>
                    Cancel Connection
                  </button>
                )}
                <button
                  className={`toolbar-btn ${showMinimap ? 'active' : ''}`}
                  onClick={() => setShowMinimap(!showMinimap)}
                >
                  Minimap
                </button>
              </div>
            </div>

            {/* Status Bar */}
            {(isAddingNode || isConnecting) && (
              <div className="brain-map-status">
                {isAddingNode && 'Click on the canvas to place a new node'}
                {isConnecting && `Click on a node to connect from "${currentMap.nodes.find(n => n.id === connectFromNodeId)?.label}"`}
              </div>
            )}

            {/* Canvas */}
            <BrainMapCanvas
              nodes={currentMap.nodes}
              connections={currentMap.connections}
              centerNodeId={currentMap.brain_map.center_node_id ?? undefined}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              isAddingNode={isAddingNode}
              isConnecting={isConnecting}
              connectFromNodeId={connectFromNodeId}
              showMinimap={showMinimap}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeDrag={handleNodeDrag}
              onCanvasClick={handleCanvasClick}
              onNodeLabelChange={handleUpdateNodeLabel}
              onConnectionDelete={handleDeleteConnection}
            />
          </>
        ) : (
          <div className="brain-map-empty">
            <p>Brain map not found</p>
          </div>
        )}
      </div>
    </div>
  );
}

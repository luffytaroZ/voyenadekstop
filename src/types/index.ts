// ============ Note Types ============
export interface Note {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  is_pinned: boolean;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NoteCreate {
  title?: string;
  content?: string;
  folder_id?: string | null;
  tags?: string[];
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  folder_id?: string | null;
  tags?: string[];
  is_pinned?: boolean;
}

// ============ Folder Types ============
export interface Folder {
  id: string;
  user_id?: string;
  name: string;
  parent_id?: string | null;
  parent_folder_id?: string | null; // Supabase uses this name
  color?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderCreate {
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
}

export interface FolderUpdate {
  name?: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
}

// ============ UI Types ============
export type Theme = 'light' | 'dark' | 'sepia' | 'high-contrast' | 'system';

export type SortOption = 'updated_at' | 'created_at' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface ViewOptions {
  sortBy: SortOption;
  sortDirection: SortDirection;
  showPinned: boolean;
}

// ============ Event Types ============
export type TimeMode = 'todo' | 'at_time' | 'all_day' | 'morning' | 'day' | 'evening' | 'anytime';
export type EventCategory = 'work' | 'meeting' | 'personal' | 'todo';
export type Priority = 'low' | 'medium' | 'high';
export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'missed' | 'skipped';
export type RecurringPattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface EventReminder {
  id: string;
  minutes_before: number;
  type: 'notification' | 'email';
}

export interface Event {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  event_type?: string;
  start_time: string | null;
  end_time: string | null;
  has_scheduled_time: boolean;
  time_mode: TimeMode;
  duration_minutes?: number;
  location?: string;
  category?: EventCategory;
  color?: string;
  priority?: Priority;
  tags: string[];
  show_on_calendar: boolean;
  is_all_day: boolean;
  is_recurring: boolean;
  recurring_pattern?: RecurringPattern;
  status?: EventStatus;
  reminders?: EventReminder[];
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface EventCreate {
  title: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  time_mode?: TimeMode;
  duration_minutes?: number;
  location?: string;
  category?: EventCategory;
  color?: string;
  priority?: Priority;
  tags?: string[];
  show_on_calendar?: boolean;
  is_all_day?: boolean;
  is_recurring?: boolean;
  recurring_pattern?: RecurringPattern;
  reminders?: EventReminder[];
}

export interface EventUpdate {
  title?: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  time_mode?: TimeMode;
  duration_minutes?: number;
  location?: string;
  category?: EventCategory;
  color?: string;
  priority?: Priority;
  tags?: string[];
  show_on_calendar?: boolean;
  is_all_day?: boolean;
  is_recurring?: boolean;
  recurring_pattern?: RecurringPattern;
  status?: EventStatus;
  reminders?: EventReminder[];
}

// ============ AI Types ============
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  messages: AIMessage[];
  created_at: string;
}

// ============ Brain Map Types ============
export type NodeShape = 'circle' | 'rectangle' | 'diamond' | 'hexagon' | 'pill';
export type NodeSize = 'small' | 'medium' | 'large' | 'xl';
export type ConnectionStyle = 'solid' | 'dashed' | 'dotted' | 'curved';
export type BrainMapTheme = 'default' | 'dark' | 'colorful' | 'minimal' | 'neon';

export interface BrainMap {
  id: string;
  title: string;
  description?: string | null;
  center_node_id?: string | null;
  center_node_text: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  theme?: BrainMapTheme | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BrainMapCreate {
  title?: string;
  description?: string;
  center_node_text?: string;
  theme?: BrainMapTheme;
}

export interface BrainMapUpdate {
  title?: string;
  description?: string;
  center_node_id?: string;
  center_node_text?: string;
  viewport_x?: number;
  viewport_y?: number;
  viewport_zoom?: number;
  theme?: BrainMapTheme;
}

export interface BrainMapNode {
  id: string;
  brain_map_id: string;
  parent_node_id?: string | null;
  label: string;
  description?: string | null;
  x: number;
  y: number;
  color?: string | null;
  shape?: NodeShape | null;
  size?: NodeSize | null;
  icon?: string | null;
  linked_note_id?: string | null;
  linked_folder_id?: string | null;
  linked_event_id?: string | null;
  is_collapsed: boolean;
  layer: number;
  created_at: string;
  updated_at: string;
}

export interface BrainMapNodeCreate {
  brain_map_id: string;
  parent_node_id?: string | null;
  label: string;
  description?: string;
  x?: number;
  y?: number;
  color?: string;
  shape?: NodeShape;
  size?: NodeSize;
  icon?: string;
  linked_note_id?: string;
  linked_folder_id?: string;
  linked_event_id?: string;
}

export interface BrainMapNodeUpdate {
  parent_node_id?: string | null;
  label?: string;
  description?: string | null;
  x?: number;
  y?: number;
  color?: string | null;
  shape?: NodeShape | null;
  size?: NodeSize | null;
  icon?: string | null;
  linked_note_id?: string | null;
  linked_folder_id?: string | null;
  linked_event_id?: string | null;
  is_collapsed?: boolean;
}

export interface BrainMapConnection {
  id: string;
  brain_map_id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string | null;
  color?: string | null;
  style?: ConnectionStyle | null;
  animated: boolean;
  created_at: string;
}

export interface BrainMapConnectionCreate {
  brain_map_id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
  color?: string;
  style?: ConnectionStyle;
  animated?: boolean;
}

export interface BrainMapWithData {
  brain_map: BrainMap;
  nodes: BrainMapNode[];
  connections: BrainMapConnection[];
}

// Computed types for canvas rendering
export interface RenderedNode extends BrainMapNode {
  screenX: number;
  screenY: number;
  radius: number;
  children: RenderedNode[];
  isHovered: boolean;
  isSelected: boolean;
  isDragging: boolean;
}

export interface RenderedConnection extends BrainMapConnection {
  sourceNode: RenderedNode;
  targetNode: RenderedNode;
}

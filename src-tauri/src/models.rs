use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub folder_id: Option<String>,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteCreate {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteUpdate {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderCreate {
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderUpdate {
    pub name: Option<String>,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

// ============ Event Models ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventReminder {
    pub id: String,
    pub minutes_before: i32,
    #[serde(rename = "type")]
    pub reminder_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub event_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub has_scheduled_time: bool,
    pub time_mode: String,
    pub duration_minutes: Option<i32>,
    pub location: Option<String>,
    pub category: Option<String>,
    pub color: Option<String>,
    pub priority: Option<String>,
    pub tags: Vec<String>,
    pub show_on_calendar: bool,
    pub is_all_day: bool,
    pub is_recurring: bool,
    pub recurring_pattern: Option<String>,
    pub status: Option<String>,
    pub reminders: Vec<EventReminder>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventCreate {
    pub title: String,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub time_mode: Option<String>,
    pub duration_minutes: Option<i32>,
    pub location: Option<String>,
    pub category: Option<String>,
    pub color: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<Vec<String>>,
    pub show_on_calendar: Option<bool>,
    pub is_all_day: Option<bool>,
    pub is_recurring: Option<bool>,
    pub recurring_pattern: Option<String>,
    pub reminders: Option<Vec<EventReminder>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub time_mode: Option<String>,
    pub duration_minutes: Option<i32>,
    pub location: Option<String>,
    pub category: Option<String>,
    pub color: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<Vec<String>>,
    pub show_on_calendar: Option<bool>,
    pub is_all_day: Option<bool>,
    pub is_recurring: Option<bool>,
    pub recurring_pattern: Option<String>,
    pub status: Option<String>,
    pub reminders: Option<Vec<EventReminder>>,
}

// ============ Brain Map Models ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMap {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub center_node_id: Option<String>,
    pub center_node_text: String,
    pub viewport_x: f64,
    pub viewport_y: f64,
    pub viewport_zoom: f64,
    pub theme: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapCreate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub center_node_text: Option<String>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub center_node_id: Option<String>,
    pub center_node_text: Option<String>,
    pub viewport_x: Option<f64>,
    pub viewport_y: Option<f64>,
    pub viewport_zoom: Option<f64>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapNode {
    pub id: String,
    pub brain_map_id: String,
    pub parent_node_id: Option<String>,
    pub label: String,
    pub description: Option<String>,
    pub x: f64,
    pub y: f64,
    pub color: Option<String>,
    pub shape: Option<String>,
    pub size: Option<String>,
    pub icon: Option<String>,
    pub linked_note_id: Option<String>,
    pub linked_folder_id: Option<String>,
    pub is_collapsed: bool,
    pub layer: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapNodeCreate {
    pub brain_map_id: String,
    pub parent_node_id: Option<String>,
    pub label: String,
    pub description: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub color: Option<String>,
    pub shape: Option<String>,
    pub size: Option<String>,
    pub icon: Option<String>,
    pub linked_note_id: Option<String>,
    pub linked_folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapNodeUpdate {
    pub parent_node_id: Option<String>,
    pub label: Option<String>,
    pub description: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub color: Option<String>,
    pub shape: Option<String>,
    pub size: Option<String>,
    pub icon: Option<String>,
    pub linked_note_id: Option<String>,
    pub linked_folder_id: Option<String>,
    pub is_collapsed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapConnection {
    pub id: String,
    pub brain_map_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub label: Option<String>,
    pub color: Option<String>,
    pub style: Option<String>,
    pub animated: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapConnectionCreate {
    pub brain_map_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub label: Option<String>,
    pub color: Option<String>,
    pub style: Option<String>,
    pub animated: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainMapWithData {
    pub brain_map: BrainMap,
    pub nodes: Vec<BrainMapNode>,
    pub connections: Vec<BrainMapConnection>,
}

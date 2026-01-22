use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

// ============ Notes Commands ============

#[tauri::command]
pub fn get_notes(db: State<Database>, folder_id: Option<String>) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = if folder_id.is_some() {
        conn.prepare(
            "SELECT id, title, content, folder_id, tags, is_pinned, created_at, updated_at, deleted_at
             FROM notes
             WHERE folder_id = ?1 AND deleted_at IS NULL
             ORDER BY is_pinned DESC, updated_at DESC",
        )
    } else {
        conn.prepare(
            "SELECT id, title, content, folder_id, tags, is_pinned, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NULL
             ORDER BY is_pinned DESC, updated_at DESC",
        )
    }
    .map_err(|e| e.to_string())?;

    let rows = if let Some(fid) = folder_id {
        stmt.query_map(params![fid], row_to_note)
    } else {
        stmt.query_map([], row_to_note)
    }
    .map_err(|e| e.to_string())?;

    let notes: Vec<Note> = rows.filter_map(|r| r.ok()).collect();
    Ok(notes)
}

#[tauri::command]
pub fn get_note(db: State<Database>, id: String) -> Result<Option<Note>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, folder_id, tags, is_pinned, created_at, updated_at, deleted_at
             FROM notes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let note = stmt.query_row(params![id], row_to_note).ok();
    Ok(note)
}

#[tauri::command]
pub fn create_note(db: State<Database>, data: NoteCreate) -> Result<Note, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = format!("note_{}", Uuid::new_v4());

    let note = Note {
        id: id.clone(),
        title: data.title.unwrap_or_default(),
        content: data.content.unwrap_or_default(),
        folder_id: data.folder_id,
        tags: data.tags.unwrap_or_default(),
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now.clone(),
        deleted_at: None,
    };

    conn.execute(
        "INSERT INTO notes (id, title, content, folder_id, tags, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            note.id,
            note.title,
            note.content,
            note.folder_id,
            serde_json::to_string(&note.tags).unwrap_or_default(),
            note.is_pinned as i32,
            note.created_at,
            note.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub fn update_note(db: State<Database>, id: String, data: NoteUpdate) -> Result<Note, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get current note
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, folder_id, tags, is_pinned, created_at, updated_at, deleted_at
             FROM notes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current: Note = stmt
        .query_row(params![id], row_to_note)
        .map_err(|e| e.to_string())?;

    let updated = Note {
        id: current.id,
        title: data.title.unwrap_or(current.title),
        content: data.content.unwrap_or(current.content),
        folder_id: data.folder_id.or(current.folder_id),
        tags: data.tags.unwrap_or(current.tags),
        is_pinned: data.is_pinned.unwrap_or(current.is_pinned),
        created_at: current.created_at,
        updated_at: now,
        deleted_at: current.deleted_at,
    };

    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, folder_id = ?3, tags = ?4, is_pinned = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            updated.title,
            updated.content,
            updated.folder_id,
            serde_json::to_string(&updated.tags).unwrap_or_default(),
            updated.is_pinned as i32,
            updated.updated_at,
            updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_note(db: State<Database>, id: String, hard: Option<bool>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if hard.unwrap_or(false) {
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
    } else {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )
    }
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn move_notes_to_folder(
    db: State<Database>,
    note_ids: Vec<String>,
    folder_id: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    for id in note_ids {
        conn.execute(
            "UPDATE notes SET folder_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![folder_id, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============ Folders Commands ============

#[tauri::command]
pub fn get_folders(db: State<Database>) -> Result<Vec<Folder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, color, icon, created_at, updated_at
             FROM folders
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], row_to_folder).map_err(|e| e.to_string())?;

    let folders: Vec<Folder> = rows.filter_map(|r| r.ok()).collect();
    Ok(folders)
}

#[tauri::command]
pub fn create_folder(db: State<Database>, data: FolderCreate) -> Result<Folder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = format!("folder_{}", Uuid::new_v4());

    let folder = Folder {
        id: id.clone(),
        name: data.name,
        parent_id: data.parent_id,
        color: data.color,
        icon: data.icon,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    conn.execute(
        "INSERT INTO folders (id, name, parent_id, color, icon, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            folder.id,
            folder.name,
            folder.parent_id,
            folder.color,
            folder.icon,
            folder.created_at,
            folder.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(folder)
}

#[tauri::command]
pub fn update_folder(db: State<Database>, id: String, data: FolderUpdate) -> Result<Folder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get current folder
    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, color, icon, created_at, updated_at
             FROM folders WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current: Folder = stmt
        .query_row(params![id], row_to_folder)
        .map_err(|e| e.to_string())?;

    let updated = Folder {
        id: current.id,
        name: data.name.unwrap_or(current.name),
        parent_id: data.parent_id.or(current.parent_id),
        color: data.color.or(current.color),
        icon: data.icon.or(current.icon),
        created_at: current.created_at,
        updated_at: now,
    };

    conn.execute(
        "UPDATE folders SET name = ?1, parent_id = ?2, color = ?3, icon = ?4, updated_at = ?5
         WHERE id = ?6",
        params![
            updated.name,
            updated.parent_id,
            updated.color,
            updated.icon,
            updated.updated_at,
            updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_folder(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Move notes in this folder to no folder
    conn.execute(
        "UPDATE notes SET folder_id = NULL WHERE folder_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    // Delete the folder
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Settings Commands ============

#[tauri::command]
pub fn get_setting(db: State<Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let value: Option<String> = stmt.query_row(params![key], |row| row.get(0)).ok();
    Ok(value)
}

#[tauri::command]
pub fn set_setting(db: State<Database>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Helper Functions ============

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    let tags_str: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    let is_pinned: i32 = row.get(5)?;

    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        folder_id: row.get(3)?,
        tags,
        is_pinned: is_pinned != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        deleted_at: row.get(8)?,
    })
}

fn row_to_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        parent_id: row.get(2)?,
        color: row.get(3)?,
        icon: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn row_to_event(row: &rusqlite::Row) -> rusqlite::Result<Event> {
    let tags_str: String = row.get(13)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    let reminders_str: String = row.get(19)?;
    let reminders: Vec<EventReminder> = serde_json::from_str(&reminders_str).unwrap_or_default();
    let has_scheduled_time: i32 = row.get(6)?;
    let show_on_calendar: i32 = row.get(14)?;
    let is_all_day: i32 = row.get(15)?;
    let is_recurring: i32 = row.get(16)?;

    Ok(Event {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        event_type: row.get(3)?,
        start_time: row.get(4)?,
        end_time: row.get(5)?,
        has_scheduled_time: has_scheduled_time != 0,
        time_mode: row.get(7)?,
        duration_minutes: row.get(8)?,
        location: row.get(9)?,
        category: row.get(10)?,
        color: row.get(11)?,
        priority: row.get(12)?,
        tags,
        show_on_calendar: show_on_calendar != 0,
        is_all_day: is_all_day != 0,
        is_recurring: is_recurring != 0,
        recurring_pattern: row.get(17)?,
        status: row.get(18)?,
        reminders,
        notes: row.get(20)?,
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
        deleted_at: row.get(23)?,
    })
}

// ============ Events Commands ============

#[tauri::command]
pub fn get_events(db: State<Database>) -> Result<Vec<Event>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, event_type, start_time, end_time, has_scheduled_time,
                    time_mode, duration_minutes, location, category, color, priority, tags,
                    show_on_calendar, is_all_day, is_recurring, recurring_pattern, status,
                    reminders, notes, created_at, updated_at, deleted_at
             FROM events
             WHERE deleted_at IS NULL
             ORDER BY start_time ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], row_to_event).map_err(|e| e.to_string())?;
    let events: Vec<Event> = rows.filter_map(|r| r.ok()).collect();
    Ok(events)
}

#[tauri::command]
pub fn get_event(db: State<Database>, id: String) -> Result<Option<Event>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, event_type, start_time, end_time, has_scheduled_time,
                    time_mode, duration_minutes, location, category, color, priority, tags,
                    show_on_calendar, is_all_day, is_recurring, recurring_pattern, status,
                    reminders, notes, created_at, updated_at, deleted_at
             FROM events WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let event = stmt.query_row(params![id], row_to_event).ok();
    Ok(event)
}

#[tauri::command]
pub fn create_event(db: State<Database>, data: EventCreate) -> Result<Event, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = format!("event_{}", Uuid::new_v4());

    let event = Event {
        id: id.clone(),
        title: data.title,
        description: data.description,
        event_type: None,
        start_time: data.start_time.clone(),
        end_time: data.end_time,
        has_scheduled_time: data.start_time.is_some(),
        time_mode: data.time_mode.unwrap_or_else(|| "at_time".to_string()),
        duration_minutes: data.duration_minutes,
        location: data.location,
        category: data.category.or(Some("personal".to_string())),
        color: data.color,
        priority: data.priority.or(Some("medium".to_string())),
        tags: data.tags.unwrap_or_default(),
        show_on_calendar: data.show_on_calendar.unwrap_or(true),
        is_all_day: data.is_all_day.unwrap_or(false),
        is_recurring: data.is_recurring.unwrap_or(false),
        recurring_pattern: data.recurring_pattern,
        status: Some("pending".to_string()),
        reminders: data.reminders.unwrap_or_default(),
        notes: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        deleted_at: None,
    };

    conn.execute(
        "INSERT INTO events (id, title, description, event_type, start_time, end_time, has_scheduled_time,
                            time_mode, duration_minutes, location, category, color, priority, tags,
                            show_on_calendar, is_all_day, is_recurring, recurring_pattern, status,
                            reminders, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)",
        params![
            event.id,
            event.title,
            event.description,
            event.event_type,
            event.start_time,
            event.end_time,
            event.has_scheduled_time as i32,
            event.time_mode,
            event.duration_minutes,
            event.location,
            event.category,
            event.color,
            event.priority,
            serde_json::to_string(&event.tags).unwrap_or_default(),
            event.show_on_calendar as i32,
            event.is_all_day as i32,
            event.is_recurring as i32,
            event.recurring_pattern,
            event.status,
            serde_json::to_string(&event.reminders).unwrap_or_default(),
            event.notes,
            event.created_at,
            event.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(event)
}

#[tauri::command]
pub fn update_event(db: State<Database>, id: String, data: EventUpdate) -> Result<Event, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get current event
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, event_type, start_time, end_time, has_scheduled_time,
                    time_mode, duration_minutes, location, category, color, priority, tags,
                    show_on_calendar, is_all_day, is_recurring, recurring_pattern, status,
                    reminders, notes, created_at, updated_at, deleted_at
             FROM events WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current: Event = stmt
        .query_row(params![id], row_to_event)
        .map_err(|e| e.to_string())?;

    let updated = Event {
        id: current.id,
        title: data.title.unwrap_or(current.title),
        description: data.description.or(current.description),
        event_type: current.event_type,
        start_time: data.start_time.or(current.start_time),
        end_time: data.end_time.or(current.end_time),
        has_scheduled_time: current.has_scheduled_time,
        time_mode: data.time_mode.unwrap_or(current.time_mode),
        duration_minutes: data.duration_minutes.or(current.duration_minutes),
        location: data.location.or(current.location),
        category: data.category.or(current.category),
        color: data.color.or(current.color),
        priority: data.priority.or(current.priority),
        tags: data.tags.unwrap_or(current.tags),
        show_on_calendar: data.show_on_calendar.unwrap_or(current.show_on_calendar),
        is_all_day: data.is_all_day.unwrap_or(current.is_all_day),
        is_recurring: data.is_recurring.unwrap_or(current.is_recurring),
        recurring_pattern: data.recurring_pattern.or(current.recurring_pattern),
        status: data.status.or(current.status),
        reminders: data.reminders.unwrap_or(current.reminders),
        notes: current.notes,
        created_at: current.created_at,
        updated_at: now,
        deleted_at: current.deleted_at,
    };

    conn.execute(
        "UPDATE events SET title = ?1, description = ?2, start_time = ?3, end_time = ?4,
                          time_mode = ?5, duration_minutes = ?6, location = ?7, category = ?8,
                          color = ?9, priority = ?10, tags = ?11, show_on_calendar = ?12,
                          is_all_day = ?13, is_recurring = ?14, recurring_pattern = ?15,
                          status = ?16, reminders = ?17, updated_at = ?18
         WHERE id = ?19",
        params![
            updated.title,
            updated.description,
            updated.start_time,
            updated.end_time,
            updated.time_mode,
            updated.duration_minutes,
            updated.location,
            updated.category,
            updated.color,
            updated.priority,
            serde_json::to_string(&updated.tags).unwrap_or_default(),
            updated.show_on_calendar as i32,
            updated.is_all_day as i32,
            updated.is_recurring as i32,
            updated.recurring_pattern,
            updated.status,
            serde_json::to_string(&updated.reminders).unwrap_or_default(),
            updated.updated_at,
            updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_event(db: State<Database>, id: String, hard: Option<bool>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if hard.unwrap_or(false) {
        conn.execute("DELETE FROM events WHERE id = ?1", params![id])
    } else {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE events SET deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )
    }
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Brain Map Commands ============

fn row_to_brain_map(row: &rusqlite::Row) -> rusqlite::Result<BrainMap> {
    Ok(BrainMap {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        center_node_id: row.get(3)?,
        center_node_text: row.get(4)?,
        viewport_x: row.get(5)?,
        viewport_y: row.get(6)?,
        viewport_zoom: row.get(7)?,
        theme: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        deleted_at: row.get(11)?,
    })
}

fn row_to_brain_map_node(row: &rusqlite::Row) -> rusqlite::Result<BrainMapNode> {
    let is_collapsed: i32 = row.get(13)?;
    Ok(BrainMapNode {
        id: row.get(0)?,
        brain_map_id: row.get(1)?,
        parent_node_id: row.get(2)?,
        label: row.get(3)?,
        description: row.get(4)?,
        x: row.get(5)?,
        y: row.get(6)?,
        color: row.get(7)?,
        shape: row.get(8)?,
        size: row.get(9)?,
        icon: row.get(10)?,
        linked_note_id: row.get(11)?,
        linked_folder_id: row.get(12)?,
        is_collapsed: is_collapsed != 0,
        layer: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

fn row_to_brain_map_connection(row: &rusqlite::Row) -> rusqlite::Result<BrainMapConnection> {
    let animated: i32 = row.get(6)?;
    Ok(BrainMapConnection {
        id: row.get(0)?,
        brain_map_id: row.get(1)?,
        source_node_id: row.get(2)?,
        target_node_id: row.get(3)?,
        label: row.get(4)?,
        color: row.get(5)?,
        style: row.get(7)?,
        animated: animated != 0,
        created_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn get_brain_maps(db: State<Database>) -> Result<Vec<BrainMap>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, center_node_id, center_node_text,
                    viewport_x, viewport_y, viewport_zoom, theme,
                    created_at, updated_at, deleted_at
             FROM brain_maps
             WHERE deleted_at IS NULL
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], row_to_brain_map).map_err(|e| e.to_string())?;
    let brain_maps: Vec<BrainMap> = rows.filter_map(|r| r.ok()).collect();
    Ok(brain_maps)
}

#[tauri::command]
pub fn get_brain_map(db: State<Database>, id: String) -> Result<Option<BrainMapWithData>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get brain map
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, center_node_id, center_node_text,
                    viewport_x, viewport_y, viewport_zoom, theme,
                    created_at, updated_at, deleted_at
             FROM brain_maps WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let brain_map: Option<BrainMap> = stmt.query_row(params![id], row_to_brain_map).ok();

    if let Some(bm) = brain_map {
        // Get nodes
        let mut node_stmt = conn
            .prepare(
                "SELECT id, brain_map_id, parent_node_id, label, description,
                        x, y, color, shape, size, icon, linked_note_id, linked_folder_id,
                        is_collapsed, layer, created_at, updated_at
                 FROM brain_map_nodes WHERE brain_map_id = ?1
                 ORDER BY layer ASC, created_at ASC",
            )
            .map_err(|e| e.to_string())?;

        let node_rows = node_stmt
            .query_map(params![id], row_to_brain_map_node)
            .map_err(|e| e.to_string())?;
        let nodes: Vec<BrainMapNode> = node_rows.filter_map(|r| r.ok()).collect();

        // Get connections
        let mut conn_stmt = conn
            .prepare(
                "SELECT id, brain_map_id, source_node_id, target_node_id, label, color, animated, style, created_at
                 FROM brain_map_connections WHERE brain_map_id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let conn_rows = conn_stmt
            .query_map(params![id], row_to_brain_map_connection)
            .map_err(|e| e.to_string())?;
        let connections: Vec<BrainMapConnection> = conn_rows.filter_map(|r| r.ok()).collect();

        Ok(Some(BrainMapWithData {
            brain_map: bm,
            nodes,
            connections,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn create_brain_map(db: State<Database>, data: BrainMapCreate) -> Result<BrainMapWithData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let map_id = format!("brainmap_{}", Uuid::new_v4());
    let center_node_id = format!("node_{}", Uuid::new_v4());

    let brain_map = BrainMap {
        id: map_id.clone(),
        title: data.title.unwrap_or_else(|| "Untitled Map".to_string()),
        description: data.description,
        center_node_id: Some(center_node_id.clone()),
        center_node_text: data.center_node_text.clone().unwrap_or_else(|| "Central Idea".to_string()),
        viewport_x: 0.0,
        viewport_y: 0.0,
        viewport_zoom: 1.0,
        theme: data.theme,
        created_at: now.clone(),
        updated_at: now.clone(),
        deleted_at: None,
    };

    // Insert brain map
    conn.execute(
        "INSERT INTO brain_maps (id, title, description, center_node_id, center_node_text,
                                 viewport_x, viewport_y, viewport_zoom, theme, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            brain_map.id,
            brain_map.title,
            brain_map.description,
            brain_map.center_node_id,
            brain_map.center_node_text,
            brain_map.viewport_x,
            brain_map.viewport_y,
            brain_map.viewport_zoom,
            brain_map.theme,
            brain_map.created_at,
            brain_map.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Create center node
    let center_node = BrainMapNode {
        id: center_node_id.clone(),
        brain_map_id: map_id.clone(),
        parent_node_id: None,
        label: data.center_node_text.unwrap_or_else(|| "Central Idea".to_string()),
        description: None,
        x: 0.0,
        y: 0.0,
        color: Some("#6366f1".to_string()),
        shape: Some("circle".to_string()),
        size: Some("large".to_string()),
        icon: None,
        linked_note_id: None,
        linked_folder_id: None,
        is_collapsed: false,
        layer: 0,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    conn.execute(
        "INSERT INTO brain_map_nodes (id, brain_map_id, parent_node_id, label, description,
                                      x, y, color, shape, size, icon, linked_note_id, linked_folder_id,
                                      is_collapsed, layer, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            center_node.id,
            center_node.brain_map_id,
            center_node.parent_node_id,
            center_node.label,
            center_node.description,
            center_node.x,
            center_node.y,
            center_node.color,
            center_node.shape,
            center_node.size,
            center_node.icon,
            center_node.linked_note_id,
            center_node.linked_folder_id,
            center_node.is_collapsed as i32,
            center_node.layer,
            center_node.created_at,
            center_node.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(BrainMapWithData {
        brain_map,
        nodes: vec![center_node],
        connections: vec![],
    })
}

#[tauri::command]
pub fn update_brain_map(db: State<Database>, id: String, data: BrainMapUpdate) -> Result<BrainMap, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get current
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, center_node_id, center_node_text,
                    viewport_x, viewport_y, viewport_zoom, theme,
                    created_at, updated_at, deleted_at
             FROM brain_maps WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current: BrainMap = stmt
        .query_row(params![id], row_to_brain_map)
        .map_err(|e| e.to_string())?;

    let updated = BrainMap {
        id: current.id,
        title: data.title.unwrap_or(current.title),
        description: data.description.or(current.description),
        center_node_id: data.center_node_id.or(current.center_node_id),
        center_node_text: data.center_node_text.unwrap_or(current.center_node_text),
        viewport_x: data.viewport_x.unwrap_or(current.viewport_x),
        viewport_y: data.viewport_y.unwrap_or(current.viewport_y),
        viewport_zoom: data.viewport_zoom.unwrap_or(current.viewport_zoom),
        theme: data.theme.or(current.theme),
        created_at: current.created_at,
        updated_at: now,
        deleted_at: current.deleted_at,
    };

    conn.execute(
        "UPDATE brain_maps SET title = ?1, description = ?2, center_node_id = ?3, center_node_text = ?4,
                              viewport_x = ?5, viewport_y = ?6, viewport_zoom = ?7, theme = ?8, updated_at = ?9
         WHERE id = ?10",
        params![
            updated.title,
            updated.description,
            updated.center_node_id,
            updated.center_node_text,
            updated.viewport_x,
            updated.viewport_y,
            updated.viewport_zoom,
            updated.theme,
            updated.updated_at,
            updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_brain_map(db: State<Database>, id: String, hard: Option<bool>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if hard.unwrap_or(false) {
        // Hard delete - cascade handled by foreign keys
        conn.execute("DELETE FROM brain_maps WHERE id = ?1", params![id])
    } else {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE brain_maps SET deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )
    }
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Brain Map Node Commands ============

#[tauri::command]
pub fn create_brain_map_node(db: State<Database>, data: BrainMapNodeCreate) -> Result<BrainMapNode, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = format!("node_{}", Uuid::new_v4());

    // Calculate layer based on parent
    let layer = if let Some(ref parent_id) = data.parent_node_id {
        let mut stmt = conn
            .prepare("SELECT layer FROM brain_map_nodes WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let parent_layer: i32 = stmt.query_row(params![parent_id], |row| row.get(0)).unwrap_or(0);
        parent_layer + 1
    } else {
        1
    };

    let node = BrainMapNode {
        id: id.clone(),
        brain_map_id: data.brain_map_id,
        parent_node_id: data.parent_node_id,
        label: data.label,
        description: data.description,
        x: data.x.unwrap_or(0.0),
        y: data.y.unwrap_or(0.0),
        color: data.color,
        shape: data.shape.or(Some("circle".to_string())),
        size: data.size.or(Some("medium".to_string())),
        icon: data.icon,
        linked_note_id: data.linked_note_id,
        linked_folder_id: data.linked_folder_id,
        is_collapsed: false,
        layer,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    conn.execute(
        "INSERT INTO brain_map_nodes (id, brain_map_id, parent_node_id, label, description,
                                      x, y, color, shape, size, icon, linked_note_id, linked_folder_id,
                                      is_collapsed, layer, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            node.id,
            node.brain_map_id,
            node.parent_node_id,
            node.label,
            node.description,
            node.x,
            node.y,
            node.color,
            node.shape,
            node.size,
            node.icon,
            node.linked_note_id,
            node.linked_folder_id,
            node.is_collapsed as i32,
            node.layer,
            node.created_at,
            node.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update brain map's updated_at
    conn.execute(
        "UPDATE brain_maps SET updated_at = ?1 WHERE id = ?2",
        params![now, node.brain_map_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(node)
}

#[tauri::command]
pub fn update_brain_map_node(db: State<Database>, id: String, data: BrainMapNodeUpdate) -> Result<BrainMapNode, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let mut stmt = conn
        .prepare(
            "SELECT id, brain_map_id, parent_node_id, label, description,
                    x, y, color, shape, size, icon, linked_note_id, linked_folder_id,
                    is_collapsed, layer, created_at, updated_at
             FROM brain_map_nodes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current: BrainMapNode = stmt
        .query_row(params![id], row_to_brain_map_node)
        .map_err(|e| e.to_string())?;

    let updated = BrainMapNode {
        id: current.id,
        brain_map_id: current.brain_map_id.clone(),
        parent_node_id: data.parent_node_id.or(current.parent_node_id),
        label: data.label.unwrap_or(current.label),
        description: data.description.or(current.description),
        x: data.x.unwrap_or(current.x),
        y: data.y.unwrap_or(current.y),
        color: data.color.or(current.color),
        shape: data.shape.or(current.shape),
        size: data.size.or(current.size),
        icon: data.icon.or(current.icon),
        linked_note_id: data.linked_note_id.or(current.linked_note_id),
        linked_folder_id: data.linked_folder_id.or(current.linked_folder_id),
        is_collapsed: data.is_collapsed.unwrap_or(current.is_collapsed),
        layer: current.layer,
        created_at: current.created_at,
        updated_at: now.clone(),
    };

    conn.execute(
        "UPDATE brain_map_nodes SET parent_node_id = ?1, label = ?2, description = ?3,
                                   x = ?4, y = ?5, color = ?6, shape = ?7, size = ?8, icon = ?9,
                                   linked_note_id = ?10, linked_folder_id = ?11, is_collapsed = ?12, updated_at = ?13
         WHERE id = ?14",
        params![
            updated.parent_node_id,
            updated.label,
            updated.description,
            updated.x,
            updated.y,
            updated.color,
            updated.shape,
            updated.size,
            updated.icon,
            updated.linked_note_id,
            updated.linked_folder_id,
            updated.is_collapsed as i32,
            updated.updated_at,
            updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update brain map's updated_at
    conn.execute(
        "UPDATE brain_maps SET updated_at = ?1 WHERE id = ?2",
        params![now, updated.brain_map_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_brain_map_node(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get brain_map_id before deleting
    let brain_map_id: Option<String> = conn
        .query_row(
            "SELECT brain_map_id FROM brain_map_nodes WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok();

    // Delete node (cascades to connections due to FK)
    conn.execute("DELETE FROM brain_map_nodes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    // Update brain map's updated_at
    if let Some(bm_id) = brain_map_id {
        conn.execute(
            "UPDATE brain_maps SET updated_at = ?1 WHERE id = ?2",
            params![now, bm_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_node_positions(
    db: State<Database>,
    updates: Vec<(String, f64, f64)>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    for (id, x, y) in updates {
        conn.execute(
            "UPDATE brain_map_nodes SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            params![x, y, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============ Brain Map Connection Commands ============

#[tauri::command]
pub fn create_brain_map_connection(
    db: State<Database>,
    data: BrainMapConnectionCreate,
) -> Result<BrainMapConnection, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let id = format!("conn_{}", Uuid::new_v4());

    let connection = BrainMapConnection {
        id: id.clone(),
        brain_map_id: data.brain_map_id.clone(),
        source_node_id: data.source_node_id,
        target_node_id: data.target_node_id,
        label: data.label,
        color: data.color,
        style: data.style.or(Some("solid".to_string())),
        animated: data.animated.unwrap_or(false),
        created_at: now.clone(),
    };

    conn.execute(
        "INSERT INTO brain_map_connections (id, brain_map_id, source_node_id, target_node_id, label, color, style, animated, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            connection.id,
            connection.brain_map_id,
            connection.source_node_id,
            connection.target_node_id,
            connection.label,
            connection.color,
            connection.style,
            connection.animated as i32,
            connection.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update brain map's updated_at
    conn.execute(
        "UPDATE brain_maps SET updated_at = ?1 WHERE id = ?2",
        params![now, data.brain_map_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(connection)
}

#[tauri::command]
pub fn delete_brain_map_connection(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM brain_map_connections WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

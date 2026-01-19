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

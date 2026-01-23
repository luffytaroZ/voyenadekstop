use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_handle: &AppHandle) -> SqliteResult<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");

        std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

        let db_path: PathBuf = app_dir.join("voyena.db");
        let conn = Connection::open(&db_path)?;

        // Initialize schema
        Self::init_schema(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn init_schema(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            r#"
            -- Folders table (local fallback when Supabase not configured)
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                color TEXT,
                icon TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
            );

            -- Notes table (local fallback when Supabase not configured)
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                folder_id TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
            );

            -- Settings table
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- Events table
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                event_type TEXT,
                start_time TEXT,
                end_time TEXT,
                has_scheduled_time INTEGER NOT NULL DEFAULT 1,
                time_mode TEXT NOT NULL DEFAULT 'at_time',
                duration_minutes INTEGER,
                location TEXT,
                category TEXT DEFAULT 'personal',
                color TEXT,
                priority TEXT DEFAULT 'medium',
                tags TEXT NOT NULL DEFAULT '[]',
                show_on_calendar INTEGER NOT NULL DEFAULT 1,
                is_all_day INTEGER NOT NULL DEFAULT 0,
                is_recurring INTEGER NOT NULL DEFAULT 0,
                recurring_pattern TEXT,
                status TEXT DEFAULT 'pending',
                reminders TEXT NOT NULL DEFAULT '[]',
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            -- Brain Maps table
            CREATE TABLE IF NOT EXISTS brain_maps (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'Untitled Map',
                description TEXT,
                center_node_id TEXT,
                center_node_text TEXT NOT NULL DEFAULT 'Central Idea',
                viewport_x REAL NOT NULL DEFAULT 0,
                viewport_y REAL NOT NULL DEFAULT 0,
                viewport_zoom REAL NOT NULL DEFAULT 1.0,
                theme TEXT DEFAULT 'default',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            -- Brain Map Nodes table
            CREATE TABLE IF NOT EXISTS brain_map_nodes (
                id TEXT PRIMARY KEY,
                brain_map_id TEXT NOT NULL,
                parent_node_id TEXT,
                label TEXT NOT NULL,
                description TEXT,
                x REAL NOT NULL DEFAULT 0,
                y REAL NOT NULL DEFAULT 0,
                color TEXT,
                shape TEXT DEFAULT 'circle',
                size TEXT DEFAULT 'medium',
                icon TEXT,
                linked_note_id TEXT,
                linked_folder_id TEXT,
                linked_event_id TEXT,
                is_collapsed INTEGER NOT NULL DEFAULT 0,
                layer INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (brain_map_id) REFERENCES brain_maps(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_node_id) REFERENCES brain_map_nodes(id) ON DELETE SET NULL,
                FOREIGN KEY (linked_note_id) REFERENCES notes(id) ON DELETE SET NULL,
                FOREIGN KEY (linked_folder_id) REFERENCES folders(id) ON DELETE SET NULL,
                FOREIGN KEY (linked_event_id) REFERENCES events(id) ON DELETE SET NULL
            );

            -- Brain Map Connections table (for non-hierarchical links)
            CREATE TABLE IF NOT EXISTS brain_map_connections (
                id TEXT PRIMARY KEY,
                brain_map_id TEXT NOT NULL,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                label TEXT,
                color TEXT,
                style TEXT DEFAULT 'solid',
                animated INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (brain_map_id) REFERENCES brain_maps(id) ON DELETE CASCADE,
                FOREIGN KEY (source_node_id) REFERENCES brain_map_nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_node_id) REFERENCES brain_map_nodes(id) ON DELETE CASCADE
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
            CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
            CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
            CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_brain_maps_deleted ON brain_maps(deleted_at);
            CREATE INDEX IF NOT EXISTS idx_brain_map_nodes_map ON brain_map_nodes(brain_map_id);
            CREATE INDEX IF NOT EXISTS idx_brain_map_nodes_parent ON brain_map_nodes(parent_node_id);
            CREATE INDEX IF NOT EXISTS idx_brain_map_connections_map ON brain_map_connections(brain_map_id);
            "#,
        )?;

        // Run migrations for existing databases
        Self::run_migrations(conn)?;

        Ok(())
    }

    fn run_migrations(conn: &Connection) -> SqliteResult<()> {
        // Migration: Add linked_event_id column to brain_map_nodes if it doesn't exist
        let columns: Vec<String> = conn
            .prepare("PRAGMA table_info(brain_map_nodes)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !columns.contains(&"linked_event_id".to_string()) {
            conn.execute(
                "ALTER TABLE brain_map_nodes ADD COLUMN linked_event_id TEXT REFERENCES events(id) ON DELETE SET NULL",
                [],
            )?;
        }

        Ok(())
    }
}

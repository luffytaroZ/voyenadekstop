mod commands;
mod db;
mod models;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize database
            let db = Database::new(app.handle())
                .expect("Failed to initialize database");
            app.manage(db);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Notes
            commands::get_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::move_notes_to_folder,
            // Folders
            commands::get_folders,
            commands::create_folder,
            commands::update_folder,
            commands::delete_folder,
            // Events
            commands::get_events,
            commands::get_event,
            commands::create_event,
            commands::update_event,
            commands::delete_event,
            // Brain Maps
            commands::get_brain_maps,
            commands::get_brain_map,
            commands::create_brain_map,
            commands::update_brain_map,
            commands::delete_brain_map,
            commands::create_brain_map_node,
            commands::update_brain_map_node,
            commands::delete_brain_map_node,
            commands::update_node_positions,
            commands::create_brain_map_connection,
            commands::delete_brain_map_connection,
            // Settings
            commands::get_setting,
            commands::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

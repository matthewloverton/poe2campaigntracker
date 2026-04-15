mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::file_io::read_user_data,
            commands::file_io::write_user_data,
            commands::log_watcher::start_log_watcher,
            commands::detect::detect_client_txt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

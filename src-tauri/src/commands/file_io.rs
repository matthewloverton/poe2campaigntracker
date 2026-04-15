use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(data_dir)
}

#[tauri::command]
pub async fn read_user_data(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[tauri::command]
pub async fn write_user_data(app: tauri::AppHandle, filename: String, data: String) -> Result<(), String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    fs::write(&path, &data).map_err(|e| format!("Failed to write {}: {}", filename, e))
}

use std::path::PathBuf;

const COMMON_PATHS: &[&str] = &[
    r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"D:\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"E:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files\Grinding Gear Games\Path of Exile 2\logs\Client.txt",
];

#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    for path_str in COMMON_PATHS {
        let path = PathBuf::from(path_str);
        if path.exists() {
            return Some(path_str.to_string());
        }
    }
    None
}

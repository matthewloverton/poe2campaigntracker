use notify::{Event, EventKind, RecursiveMode, Watcher};
use regex::Regex;
use serde::Serialize;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::sync::mpsc;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct ZoneChangeEvent {
    #[serde(rename = "areaId")]
    pub area_id: String,
    pub level: u32,
    pub timestamp: String,
}

pub fn parse_zone_change(line: &str) -> Option<ZoneChangeEvent> {
    let re = Regex::new(r#"Generating level (\d+) area "([^"]+)" with seed"#).unwrap();
    if let Some(caps) = re.captures(line) {
        let level = caps.get(1)?.as_str().parse::<u32>().ok()?;
        let area_id = caps.get(2)?.as_str().to_lowercase();
        let timestamp = chrono::Utc::now().to_rfc3339();
        return Some(ZoneChangeEvent { area_id, level, timestamp });
    }
    None
}

#[derive(Debug, Clone, Serialize)]
pub struct LevelUpEvent {
    #[serde(rename = "characterName")]
    pub character_name: String,
    pub level: u32,
    pub class: String,
    pub timestamp: String,
}

pub fn parse_level_up(line: &str) -> Option<LevelUpEvent> {
    // Match: "CHARACTER_NAME (Class) is now level N"
    let re = Regex::new(r": (\S+) \((\w+)\) is now level (\d+)").unwrap();
    if let Some(caps) = re.captures(line) {
        return Some(LevelUpEvent {
            character_name: caps.get(1)?.as_str().to_string(),
            level: caps.get(3)?.as_str().parse::<u32>().ok()?,
            class: caps.get(2)?.as_str().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }
    // Match: "CHARACTER_NAME is a level N Class in the..."
    let re2 = Regex::new(r": (\S+) is a level (\d+) (\w+) in the").unwrap();
    if let Some(caps) = re2.captures(line) {
        return Some(LevelUpEvent {
            character_name: caps.get(1)?.as_str().to_string(),
            level: caps.get(2)?.as_str().parse::<u32>().ok()?,
            class: caps.get(3)?.as_str().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }
    None
}

#[tauri::command]
pub async fn start_log_watcher(app: tauri::AppHandle, log_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&log_path);
    if !path.exists() {
        return Err(format!("Log file not found: {}", log_path));
    }
    eprintln!("[log_watcher] Starting watcher for: {}", log_path);
    tauri::async_runtime::spawn(async move {
        if let Err(e) = watch_log_file(app, &path) {
            eprintln!("[log_watcher] Watcher error: {}", e);
        }
    });
    Ok(())
}

fn process_new_lines(app: &tauri::AppHandle, file: &mut File, pos: &mut u64) {
    let new_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return,
    };
    if new_len <= *pos {
        return;
    }
    if file.seek(SeekFrom::Start(*pos)).is_err() {
        return;
    }
    let reader = BufReader::new(file as &File);
    for line in reader.lines().map_while(Result::ok) {
        if let Some(zone_event) = parse_zone_change(&line) {
            eprintln!("[log_watcher] Zone change: {} (level {})", zone_event.area_id, zone_event.level);
            let _ = app.emit("zone-changed", &zone_event);
        }
        if let Some(level_event) = parse_level_up(&line) {
            eprintln!("[log_watcher] Level up: {} -> {}", level_event.character_name, level_event.level);
            let _ = app.emit("level-changed", &level_event);
        }
    }
    *pos = new_len;
}

fn watch_log_file(app: tauri::AppHandle, path: &std::path::Path) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut pos = file.metadata().map_err(|e| e.to_string())?.len();
    file.seek(SeekFrom::Start(pos)).map_err(|e| e.to_string())?;
    eprintln!("[log_watcher] Opened file, starting at byte {}", pos);

    // Try notify-based watching first, fall back to polling
    let (tx, rx) = mpsc::channel();
    let watcher_result = notify::recommended_watcher(tx.clone())
        .and_then(|mut w| {
            // Watch the parent directory (more reliable on Windows)
            let parent = path.parent().unwrap_or(path);
            w.watch(parent, RecursiveMode::NonRecursive)?;
            Ok(w)
        });

    match watcher_result {
        Ok(_watcher) => {
            eprintln!("[log_watcher] Using notify-based file watching");
            // Use recv_timeout so we also poll periodically as a fallback
            loop {
                match rx.recv_timeout(std::time::Duration::from_secs(2)) {
                    Ok(Ok(Event { kind: EventKind::Modify(_), .. })) => {
                        process_new_lines(&app, &mut file, &mut pos);
                    }
                    Ok(_) => {} // other event types
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Poll fallback — check file size even without notify event
                        process_new_lines(&app, &mut file, &mut pos);
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        eprintln!("[log_watcher] Watcher disconnected, switching to polling");
                        break;
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("[log_watcher] Notify failed ({}), using polling", e);
        }
    }

    // Pure polling fallback
    eprintln!("[log_watcher] Polling mode active");
    loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        process_new_lines(&app, &mut file, &mut pos);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_zone_change_valid_line() {
        let line = r#"2025-01-15 12:34:56 12345 [INFO Client 1234] [ENGINE] Generating level 5 area "G1_2" with seed 98765"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.area_id, "g1_2");
        assert_eq!(event.level, 5);
    }

    #[test]
    fn test_parse_zone_change_town() {
        let line = r#"Generating level 1 area "G1_town" with seed 12345"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        assert_eq!(result.unwrap().area_id, "g1_town");
    }

    #[test]
    fn test_parse_zone_change_no_match() {
        let line = "2025-01-15 12:34:56 [INFO Client] Connected to server";
        assert!(parse_zone_change(line).is_none());
    }

    #[test]
    fn test_parse_zone_change_act2() {
        let line = r#"Generating level 20 area "G2_5" with seed 55555"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        assert_eq!(result.unwrap().area_id, "g2_5");
    }

    #[test]
    fn test_parse_level_up() {
        let line = r#"2026/04/10 23:51:02 2466126781 3ef232c2 [INFO Client 43800] : PETE_CAMPAIGN_PRAC (Sorceress) is now level 2"#;
        let result = parse_level_up(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.character_name, "PETE_CAMPAIGN_PRAC");
        assert_eq!(event.level, 2);
        assert_eq!(event.class, "Sorceress");
    }

    #[test]
    fn test_parse_initial_character() {
        let line = r#"2026/04/10 22:32:44 2461429000 3ef232c2 [INFO Client 43800] : PETE_CAMPAIGN_PRAC is a level 1 Sorceress in the Fate of the Vaal league and is currently playing in The Riverbank."#;
        let result = parse_level_up(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.character_name, "PETE_CAMPAIGN_PRAC");
        assert_eq!(event.level, 1);
        assert_eq!(event.class, "Sorceress");
    }

    #[test]
    fn test_parse_level_up_no_match() {
        let line = "2026/04/10 22:17:25 [DEBUG Client 43800] Generating level 1 area \"G1_1\" with seed 123";
        assert!(parse_level_up(line).is_none());
    }
}

import { useState, useEffect, useCallback } from "react";
import type { UnlockNotification } from "../../hooks/useAutoAdvance";
import styles from "./UnlockOverlay.module.css";

interface UnlockOverlayProps {
  notification: UnlockNotification;
  onDismiss: () => void;
}

export function UnlockOverlay({ notification, onDismiss }: UnlockOverlayProps) {
  const [fading, setFading] = useState(false);

  const startFade = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(onDismiss, 600);
  }, [fading, onDismiss]);

  // Auto-fade before auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => startFade(), 7000);
    return () => clearTimeout(timer);
  }, [notification.id, startFade]);

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.overlayFading : ""}`}
      onClick={startFade}
    >
      <div className={`${styles.card} ${fading ? styles.cardFading : ""}`}>
        <div className={styles.levelBadge}>Level {notification.level}</div>
        <div className={styles.title}>New unlocks available</div>
        <div className={styles.items}>
          {notification.items.map((item, i) => (
            <div key={i} className={styles.item}>
              <div className={`${styles.iconWrap} ${item.type === "gem" ? styles.iconWrapGem : ""}`}>
                {item.iconPath ? (
                  <img
                    className={styles.icon}
                    src={`/assets/${item.iconPath}`}
                    alt={item.name}
                  />
                ) : (
                  <span className={styles.iconFallback}>?</span>
                )}
              </div>
              <span className={styles.itemName}>{item.name}</span>
            </div>
          ))}
        </div>
        <div className={styles.dismiss}>click to dismiss</div>
      </div>
    </div>
  );
}

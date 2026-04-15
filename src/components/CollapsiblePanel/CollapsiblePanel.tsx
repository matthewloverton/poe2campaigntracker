import { useState, type ReactNode } from "react";
import styles from "./CollapsiblePanel.module.css";

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsiblePanel({ title, children, defaultOpen = true }: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={styles.panel}>
      <button className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.title}>{title}</span>
        <span className={styles.chevron}>{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen && <div className={styles.content}>{children}</div>}
    </div>
  );
}

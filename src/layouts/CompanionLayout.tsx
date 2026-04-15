import type { ReactNode } from "react";
import styles from "./CompanionLayout.module.css";

interface CompanionLayoutProps {
  primary: ReactNode;
  secondary: ReactNode;
}

export function CompanionLayout({ primary, secondary }: CompanionLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.primary}>{primary}</div>
      <div className={styles.secondary}>{secondary}</div>
    </div>
  );
}

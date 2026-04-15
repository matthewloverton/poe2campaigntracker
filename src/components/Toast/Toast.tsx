import styles from "./Toast.module.css";

interface ToastProps {
  messages: { id: number; text: string }[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ messages, onDismiss }: ToastProps) {
  if (messages.length === 0) return null;
  return (
    <div className={styles.container}>
      {messages.map((msg) => (
        <div key={msg.id} className={styles.toast} onClick={() => onDismiss(msg.id)}>
          {msg.text}
        </div>
      ))}
    </div>
  );
}

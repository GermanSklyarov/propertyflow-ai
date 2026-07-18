import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./load-state.module.css";

export function LoadState({
  icon,
  kicker,
  message,
  title,
  variant = "error"
}: {
  icon?: ReactNode;
  kicker: string;
  message: string;
  title: string;
  variant?: "error" | "loading";
}) {
  return (
    <div className={`${styles.state} ${styles[variant]}`}>
      {icon ?? (variant === "loading" ? <LoaderCircle size={20} /> : <AlertTriangle size={20} />)}
      <div className={styles.body}>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        <span>{message}</span>
      </div>
    </div>
  );
}

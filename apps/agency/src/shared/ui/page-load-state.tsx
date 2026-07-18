import { LoadState } from "./load-state";
import styles from "./page-load-state.module.css";

export function PageLoadState({
  kicker,
  message,
  title,
  variant = "loading"
}: {
  kicker: string;
  message: string;
  title: string;
  variant?: "error" | "loading";
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <LoadState kicker={kicker} message={message} title={title} variant={variant} />
      </div>
    </main>
  );
}

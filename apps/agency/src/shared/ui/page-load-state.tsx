import { LoadState } from "./load-state";
import styles from "./page-load-state.module.css";

export function PageLoadState({
  kicker,
  message,
  title
}: {
  kicker: string;
  message: string;
  title: string;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <LoadState kicker={kicker} message={message} title={title} variant="loading" />
      </div>
    </main>
  );
}

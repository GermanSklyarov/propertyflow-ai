"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./create-listing-form.module.css";

interface FileDropFieldProps {
  accept: string;
  description: string;
  icon: ReactNode;
  multiple?: boolean;
  name: string;
  title: string;
  variant?: "default" | "photo";
}

export function FileDropField({ accept, description, icon, multiple, name, title, variant = "default" }: FileDropFieldProps) {
  const [files, setFiles] = useState<File[]>([]);
  const fileSummary = useMemo(() => {
    if (!files.length) {
      return "Drop file here or click to browse";
    }

    if (files.length === 1) {
      return files[0].name;
    }

    return `${files.length} files selected`;
  }, [files]);

  return (
    <label className={`${styles.fileDrop} ${variant === "photo" ? styles.photoDrop : ""} ${files.length ? styles.fileDropActive : ""}`}>
      {icon}
      <span>{title}</span>
      <small>{description}</small>
      <strong className={styles.fileDropStatus}>{fileSummary}</strong>
      <input
        accept={accept}
        multiple={multiple}
        name={name}
        onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
        type="file"
      />
    </label>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./file-drop-field.module.css";

interface FileDropFieldProps {
  accept: string;
  className?: string;
  description: string;
  icon: ReactNode;
  multiple?: boolean;
  name: string;
  required?: boolean;
  title: string;
  variant?: "default" | "compact" | "photo";
}

export function FileDropField({
  accept,
  className,
  description,
  icon,
  multiple,
  name,
  required,
  title,
  variant = "default"
}: FileDropFieldProps) {
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
    <label
      className={`${styles.fileDrop} ${variant === "compact" ? styles.compact : ""} ${
        variant === "photo" ? styles.photo : ""
      } ${files.length ? styles.fileDropActive : ""} ${className ?? ""}`}
    >
      {icon}
      <span>{title}</span>
      <small>{description}</small>
      <strong className={styles.fileDropStatus}>{fileSummary}</strong>
      <input
        accept={accept}
        multiple={multiple}
        name={name}
        onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
        required={required}
        type="file"
      />
    </label>
  );
}

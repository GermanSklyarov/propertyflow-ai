import type { CSSProperties } from "react";

export function PropertyFlowMark({
  className,
  style
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      style={style}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#0B2F2B" height="48" rx="12" width="48" />
      <path d="M11 28.5L24 17L37 28.5" stroke="#E9FFFA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M15.5 27.5V37H32.5V27.5" stroke="#E9FFFA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M21 37V29.5H27V37" stroke="#E9FFFA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M14 13C20.5 9 27.5 9 34 13" stroke="#2FD0C0" strokeLinecap="round" strokeWidth="3.2" />
      <path d="M17 18C21.5 15.6 26.5 15.6 31 18" stroke="#2FD0C0" strokeLinecap="round" strokeWidth="3.2" />
      <path d="M34.5 8.5L36.2 12.1L40 13L36.2 13.9L34.5 17.5L32.8 13.9L29 13L32.8 12.1L34.5 8.5Z" fill="#FF8067" />
    </svg>
  );
}

export function PropertyFlowBrand({
  className,
  markClassName,
  wordmarkClassName
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={className}>
      <PropertyFlowMark className={markClassName} />
      <span className={wordmarkClassName}>PropertyFlow AI</span>
    </span>
  );
}

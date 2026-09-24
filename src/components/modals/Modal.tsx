import type { CSSProperties, ReactNode } from "react";

export default function Modal({ open, children, boxStyle }: { open: boolean; children: ReactNode; boxStyle?: CSSProperties }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={boxStyle}>
        {children}
      </div>
    </div>
  );
}

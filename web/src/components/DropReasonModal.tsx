import { useEffect, useRef, useState } from "react";

interface Props {
  shiftLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export default function DropReasonModal({ shiftLabel, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 20, width: 400, maxWidth: "92%" }}
      >
        <h3 style={{ marginBottom: 2 }}>Drop shift</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          You're dropping {shiftLabel} to the pool. Add a reason — this is only
          visible to your manager.
        </p>
        <input
          ref={inputRef}
          placeholder="e.g. doctor's appointment, family emergency"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm(reason)}
        />
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onConfirm(reason)}>
            Drop shift
          </button>
        </div>
      </div>
    </div>
  );
}

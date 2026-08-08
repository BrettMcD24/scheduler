import { useEffect, useRef, useState } from "react";

interface Props {
  employeeName: string;
  dateLabel: string;
  onConfirm: (code: string) => void;
  onCancel: () => void;
  error?: string;
}

const QUICK_CODES = ["8-4", "9-4", "11-730", "4-1045", "2-C"];

export default function AssignModal({
  employeeName,
  dateLabel,
  onConfirm,
  onCancel,
  error,
}: Props) {
  const [code, setCode] = useState("");
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

  function confirm() {
    if (code.trim()) onConfirm(code.trim());
  }

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
        style={{ padding: 20, width: 360, maxWidth: "90%" }}
      >
        <h3 style={{ marginBottom: 4 }}>Assign {employeeName}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Enter a shift code for {dateLabel}
        </p>
        <input
          ref={inputRef}
          placeholder="e.g. 8-4, 2-C, 1130-730"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
        />
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {QUICK_CODES.map((c) => (
            <button
              key={c}
              style={{ padding: "3px 10px", fontSize: 13 }}
              onClick={() => setCode(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {error && (
          <div
            className="tag-danger"
            style={{ padding: "6px 10px", borderRadius: 6, marginTop: 10, fontSize: 13 }}
          >
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={confirm} disabled={!code.trim()}>
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

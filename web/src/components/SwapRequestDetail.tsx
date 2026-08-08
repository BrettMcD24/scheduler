import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { formatShiftRange, formatDateLabel } from "../lib/format";
import type { SwapDetail } from "../lib/types";

/** Renders one person's row: their original shift struck through, the proposed
 * new shift beside it. */
function PersonRow({
  name,
  original,
  proposed,
}: {
  name: string;
  original: { on_date: string; start_time: string; end_time: string } | null;
  proposed: { on_date: string; start_time: string; end_time: string } | null;
}) {
  return (
    <div className="card" style={{ padding: "10px 12px", boxShadow: "none" }}>
      <strong>{name}</strong>
      <div className="row" style={{ gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        <span className="muted">
          Now:{" "}
          {original ? (
            <span style={{ textDecoration: "line-through" }}>
              {formatDateLabel(original.on_date)}{" "}
              {formatShiftRange(original.start_time, original.end_time)}
            </span>
          ) : (
            "—"
          )}
        </span>
        <span>
          → After:{" "}
          {proposed ? (
            <strong>
              {formatDateLabel(proposed.on_date)}{" "}
              {formatShiftRange(proposed.start_time, proposed.end_time)}
            </strong>
          ) : (
            <span className="muted">gives up shift</span>
          )}
        </span>
      </div>
    </div>
  );
}

export default function SwapRequestDetail({ swapId }: { swapId: number }) {
  const [detail, setDetail] = useState<SwapDetail | null>(null);

  useEffect(() => {
    api.swapDetail(swapId).then(setDetail).catch(() => {});
  }, [swapId]);

  if (!detail) return <p className="muted" style={{ margin: "8px 0" }}>Loading…</p>;

  // Requester currently holds requesting_shift, would move to target_shift.
  // Target currently holds target_shift, would move to requesting_shift.
  return (
    <div className="stack" style={{ gap: 6, marginTop: 10 }}>
      {detail.drop_reason && (
        <div className="tag-warn" style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13 }}>
          Reason given: {detail.drop_reason}
        </div>
      )}
      <PersonRow
        name={detail.requesting_employee_name}
        original={detail.requesting_shift}
        proposed={detail.target_shift}
      />
      <PersonRow
        name={detail.target_employee_name ?? "Pool (unclaimed)"}
        original={detail.target_shift}
        proposed={detail.requesting_shift}
      />
    </div>
  );
}

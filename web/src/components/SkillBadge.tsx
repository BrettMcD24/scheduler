const COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#f0ede6", fg: "#6b6b66" },
  2: { bg: "#fbf0d8", fg: "#9a6b08" },
  3: { bg: "#eaf3de", fg: "#3b6d11" },
  4: { bg: "#e1f5ee", fg: "#0f6e56" },
  5: { bg: "#eeedfe", fg: "#3c3489" },
};

export default function SkillBadge({ level }: { level: number | null }) {
  if (!level) return null;
  const c = COLORS[level] ?? COLORS[1];
  return (
    <span
      className="badge"
      style={{ background: c.bg, color: c.fg, border: "none" }}
      title={`Skill level ${level}`}
    >
      L{level}
    </span>
  );
}

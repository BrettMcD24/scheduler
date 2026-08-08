import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/types";
import SkillBadge from "../components/SkillBadge";

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);

  useEffect(() => {
    api.listEmployees(user?.store_id ?? undefined).then(setEmployees);
  }, [user]);

  function ageOf(dob: string | null): string {
    if (!dob) return "—";
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (
      now.getMonth() < d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
    )
      age--;
    return String(age);
  }

  return (
    <div>
      <h2>Employees</h2>
      <div className="card" style={{ padding: 0, marginTop: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg)", textAlign: "left" }}>
              <th style={cell}>Name</th>
              <th style={cell}>Role</th>
              <th style={cell}>Skill</th>
              <th style={cell}>Age</th>
              <th style={cell}>Desired hrs</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={cell}>
                  {e.first_name} {e.last_name}
                </td>
                <td style={cell}>{e.role}</td>
                <td style={cell}>
                  <SkillBadge level={e.skill_level} />
                </td>
                <td style={cell}>
                  {ageOf(e.dob)}
                  {e.dob && Number(ageOf(e.dob)) < 18 && (
                    <span className="tag-warn badge" style={{ marginLeft: 6 }}>minor</span>
                  )}
                </td>
                <td style={cell}>
                  {e.desired_hours_min != null && e.desired_hours_max != null
                    ? `${e.desired_hours_min}–${e.desired_hours_max}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = { padding: "10px 14px" };

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TonneChart({ rows }: { rows: { code: string; declared: number; sgs: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No tonnes in this view.</p>;
  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="code" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--color-primary-soft)" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                color: "var(--color-ink)",
              }}
            />
            <Bar dataKey="declared" name="Declared MT" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sgs" name="SGS MT" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex gap-4 text-xs font-semibold tracking-wide text-muted uppercase">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-sm bg-primary" /> Declared
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-sm bg-accent" /> SGS captured
        </span>
      </p>
    </div>
  );
}

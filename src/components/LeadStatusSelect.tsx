"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["new", "contacted", "closed"];

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

export function LeadStatusSelect({
  leadId,
  status,
  canWrite = true,
}: {
  leadId: string;
  status: string;
  canWrite?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setValue(next);
    setSaving(true);
    await supabase.from("planner_leads").update({ status: next }).eq("id", leadId);
    setSaving(false);
    router.refresh();
  };

  if (!canWrite) {
    return <span className="text-xs bg-cream px-2.5 py-1.5 rounded-full">{STATUS_LABEL[value] ?? value}</span>;
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="text-xs bg-cream px-2.5 py-1.5 rounded-full border-0 focus:outline-none disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

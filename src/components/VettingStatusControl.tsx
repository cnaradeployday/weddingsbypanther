"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-sage/15 text-sage",
  pending: "bg-gold/20 text-dark",
  suspended: "bg-terracotta/15 text-terracotta-dark",
};

export function VettingStatusControl({
  table,
  id,
  status,
  canWrite = true,
}: {
  table: "planners" | "suppliers";
  id: string;
  status: string;
  canWrite?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [working, setWorking] = useState(false);

  const update = async (next: string) => {
    setWorking(true);
    await supabase.from(table).update({ status: next }).eq("id", id);
    setValue(next);
    setWorking(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[value]}`}>{value}</span>
      {canWrite && value !== "approved" && (
        <button
          onClick={() => update("approved")}
          disabled={working}
          className="text-xs text-sage font-medium disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {canWrite && value !== "suspended" && (
        <button
          onClick={() => update("suspended")}
          disabled={working}
          className="text-xs text-terracotta-dark font-medium disabled:opacity-50"
        >
          Suspend
        </button>
      )}
    </div>
  );
}

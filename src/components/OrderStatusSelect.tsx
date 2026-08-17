"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["pending_proof", "in_production", "shipped", "delivered", "cancelled"];

const STATUS_LABEL: Record<string, string> = {
  pending_proof: "Pending proof",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setValue(next);
    setSaving(true);
    await supabase.from("orders").update({ status: next }).eq("id", orderId);
    setSaving(false);
    router.refresh();
  };

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

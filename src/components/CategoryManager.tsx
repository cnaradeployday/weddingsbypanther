"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Category = { id: string; name: string; slug: string; sort_order: number; banner_url: string | null };

function BannerCell({ category, canWrite }: { category: Category; canWrite: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `categories/${category.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file);
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
      await supabase.from("categories").update({ banner_url: publicUrl.publicUrl }).eq("id", category.id);
      router.refresh();
    }
    setUploading(false);
  };

  return (
    <label
      className={`relative block h-14 w-24 rounded-md overflow-hidden border border-line bg-cream shrink-0 ${
        canWrite ? "cursor-pointer hover:border-dark" : ""
      }`}
    >
      {category.banner_url ? (
        <Image src={category.banner_url} alt="" fill className="object-cover" unoptimized />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted text-center px-1">
          {canWrite ? "Click to upload" : "No banner"}
        </span>
      )}
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px]">...</span>
      )}
      {canWrite && (
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      )}
    </label>
  );
}

export function CategoryManager({
  categories,
  businessType,
  canWrite = true,
}: {
  categories: Category[];
  businessType: "wedding" | "merchandise";
  canWrite?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await supabase.from("categories").insert({
      name,
      slug: slugify(name),
      sort_order: categories.length + 1,
      business_type: businessType,
    });
    setName("");
    setSubmitting(false);
    router.refresh();
  };

  return (
    <div>
      <div className="rounded-xl border border-line bg-white overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Banner</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-5 py-4">
                  <BannerCell category={c} canWrite={canWrite} />
                </td>
                <td className="px-5 py-4 font-medium">{c.name}</td>
                <td className="px-5 py-4 text-muted">{c.slug}</td>
                <td className="px-5 py-4 text-muted">{c.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-line px-4 py-3 focus:outline-none focus:border-dark"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-3 rounded-full bg-dark text-cream-light text-sm font-medium hover:bg-dark-soft transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

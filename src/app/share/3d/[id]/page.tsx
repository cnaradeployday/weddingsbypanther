import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Share3DView } from "@/components/Share3DView";
import type { ZoneTextureInput } from "@/components/Product3DViewer";

// A persisted copy of one shopper's 3D render (see ProductConfigurator's
// createShare3D) — public and login-free so the link/QR this page serves
// opens the same way for anyone, independent of the live builder session
// that created it.
function parseZoneTextures(raw: unknown): ZoneTextureInput[] {
  if (!Array.isArray(raw)) return [];
  const result: ZoneTextureInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const uvBox = e.uvBox as Record<string, unknown> | undefined;
    const artworkUrl = e.artworkUrl;
    if (
      uvBox &&
      typeof uvBox.u0 === "number" &&
      typeof uvBox.v0 === "number" &&
      typeof uvBox.u1 === "number" &&
      typeof uvBox.v1 === "number" &&
      typeof artworkUrl === "string"
    ) {
      result.push({
        uvBox: { u0: uvBox.u0, v0: uvBox.v0, u1: uvBox.u1, v1: uvBox.v1 },
        artworkDataUrl: artworkUrl,
      });
    }
  }
  return result;
}

export default async function Share3DPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: share } = await supabase
    .from("product_3d_shares")
    .select("glb_url, active_mesh_name, other_mesh_names, zone_textures")
    .eq("id", id)
    .maybeSingle();

  if (!share) notFound();

  return (
    <Share3DView
      glbUrl={share.glb_url}
      activeMeshName={share.active_mesh_name}
      otherMeshNames={share.other_mesh_names}
      zoneTextures={parseZoneTextures(share.zone_textures)}
    />
  );
}

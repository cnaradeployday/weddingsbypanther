"use client";

import Image from "next/image";
import { boundingBox } from "@/lib/quadGeometry";
import { textFontStyle } from "@/lib/textFonts";

// A small recognition aid for FLOW-02's recovery modal — the reference
// photo with just the names text overlaid at its saved position/color/font.
// Deliberately not a full, pixel-accurate composite (that's what the Preview
// modal's server-rendered snapshot is for) — this only needs to help a
// shopper tell two saved designs apart at a glance.
export function DesignThumbnail({
  photoUrl,
  zone,
  names,
  textFont,
  namesColor,
  namesPosition,
}: {
  photoUrl: string | null;
  zone?: { corners_pct: { x: number; y: number }[] } | null;
  names: string;
  textFont: string;
  namesColor: string;
  namesPosition: { x: number; y: number };
}) {
  const zoneBox = zone && zone.corners_pct.length === 4 ? boundingBox(zone.corners_pct) : null;
  return (
    <div className="relative aspect-[4/5] w-16 shrink-0 rounded-lg overflow-hidden border border-line bg-cream">
      {photoUrl && <Image src={photoUrl} alt="" fill className="object-cover" unoptimized />}
      {zoneBox && names.trim() && (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[7px] leading-none text-center px-0.5 max-w-full truncate"
          style={{
            left: `${zoneBox.left + (namesPosition.x / 100) * zoneBox.width}%`,
            top: `${zoneBox.top + (namesPosition.y / 100) * zoneBox.height}%`,
            color: namesColor,
            ...textFontStyle(textFont),
          }}
        >
          {names}
        </span>
      )}
    </div>
  );
}

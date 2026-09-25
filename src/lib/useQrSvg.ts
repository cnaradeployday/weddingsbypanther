"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { isValidQrUrl } from "./qrValidation";

// Generates the QR code's SVG markup client-side (EDIT-13: "generate a QR
// code as a vector element") whenever the URL or color changes. Returns
// null while there's nothing valid to render yet.
export function useQrSvg(url: string, colorHex: string): string | null {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidQrUrl(url)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSvg(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: colorHex, light: "#00000000" },
    })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, colorHex]);

  return svg;
}

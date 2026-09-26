"use client";

import { useState, useEffect } from "react";
import { isValidQrUrl } from "@/lib/qrValidation";
import { ColorPicker } from "./ColorPicker";

// EDIT-13: enter a URL, validate it, pick a color. No minimum-scannable-
// size enforcement — that must come from product/technique configuration,
// which doesn't exist anywhere in the schema (DISCOVERY.md gap #2), so
// this deliberately doesn't invent a number to enforce.
export function QrToolPanel({
  url,
  onChangeUrl,
  color,
  onChangeColor,
}: {
  url: string;
  onChangeUrl: (url: string) => void;
  color: string;
  onChangeColor: (hex: string) => void;
}) {
  const [input, setInput] = useState(url);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(url);
  }, [url]);

  const touched = input.trim().length > 0;
  const valid = isValidQrUrl(input);

  const commit = () => {
    if (isValidQrUrl(input)) onChangeUrl(input.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[22px]" style={{ color: "var(--pc-ink-950)" }}>
          QR code
        </h2>
        <p className="text-sm" style={{ color: "var(--pc-ink-500)" }}>
          Links to any URL.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          id="qr-url"
          // Deliberately type="text" (not "url"): some browsers treat a
          // bare `<input type="url">` — with no enclosing <form> — as a
          // navigable address field and, on Enter, navigate the tab
          // straight to whatever's typed, which crashes the SPA state and
          // loses the ?step= URL entirely. inputMode="url" alone still
          // gives mobile keyboards the right layout (a ".com"/"go" key)
          // without that navigation heuristic.
          type="text"
          inputMode="url"
          placeholder="https://"
          aria-label="Link URL"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          aria-invalid={touched && !valid}
          aria-describedby={touched && !valid ? "qr-url-error" : undefined}
          className="w-full h-11 rounded-xl border-[1.5px] px-3.5 text-[15px] outline-none"
          style={{
            borderColor: touched && !valid ? "var(--pc-danger)" : "var(--pc-ink-200)",
            background: "var(--pc-ink-50)",
            color: "var(--pc-ink-950)",
          }}
        />
        {touched && !valid && (
          <p id="qr-url-error" className="text-xs" style={{ color: "var(--pc-danger)" }}>
            Enter a valid web address (starting with https:// or http://).
          </p>
        )}
      </div>
      {url && (
        <>
          <ColorPicker value={color} onChange={onChangeColor} label="Code color" />
          <p className="text-xs" style={{ color: "var(--pc-ink-400)" }}>
            Scan this code yourself with a phone camera before ordering, to make sure it links where you expect.
          </p>
        </>
      )}
    </div>
  );
}

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
          // loses the ?step= URL entirely.
          //
          // inputMode="url" was ALSO still here, and turned out to be its
          // own separate trigger for the same symptom ("This page couldn't
          // load") even with type="text": on Android (stock Chrome/Samsung
          // Internet/in-app WebViews, and this app's own installed-PWA
          // standalone window — see manifest.json's display:"standalone",
          // which has no address bar to absorb a failed navigation),
          // inputMode="url" maps the keyboard's enter key to the IME "Go"
          // action, which a number of these browser shells handle as "open
          // this URL" at the OS/browser-chrome level — entirely bypassing
          // this component's onKeyDown/preventDefault, since no page-level
          // Enter keydown ever fires on that path. enterKeyHint="done"
          // overrides that action mapping to a plain "dismiss keyboard",
          // closing the one path none of the JS-level guards here could
          // reach.
          type="text"
          enterKeyHint="done"
          // Some browsers show a native address-style autofill dropdown for
          // a URL-shaped text field and can navigate on Enter from that
          // dropdown's own suggestion, bypassing this component's handler
          // entirely — turning it off removes that path too, on top of the
          // type="text"/preventDefault guards above.
          autoComplete="off"
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

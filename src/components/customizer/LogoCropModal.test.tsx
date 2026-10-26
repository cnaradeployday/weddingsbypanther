import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LogoCropModal } from "./LogoCropModal";

// "mira como mande a cropear y como quedo, hay bug" — the crop frame used
// to be a hardcoded square no matter the logo's own shape, with the image
// fit inside it via object-contain. For a non-square logo that letterboxes
// (empty bands on one axis), so the frame's 0-1 drag fractions stop lining
// up with the same fraction of the actual image once cropImage.ts maps
// them straight onto the real source pixels — a selection drawn around the
// visible text crops a shifted/wrong-scale slice instead. Sizing the frame
// to the image's own aspect ratio removes the letterbox entirely, so frame
// fractions and image fractions are the same thing again.
describe("LogoCropModal", () => {
  it("sizes the crop frame to the loaded image's own aspect ratio, not a fixed square", () => {
    const { container } = render(
      <LogoCropModal preview="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    const frame = img!.parentElement as HTMLElement;

    // Before the image loads, nothing has told the frame it's non-square —
    // it must not still be hardcoded elsewhere. jsdom normalizes the CSS
    // value to "1 / 1".
    expect(frame.style.aspectRatio).toBe("1 / 1");

    // A wide banner logo (800x200, aspect ratio 4) — jsdom never actually
    // decodes image bytes, so naturalWidth/naturalHeight are set directly
    // on the element before firing the same "load" event the real browser
    // would dispatch once decoding finishes.
    Object.defineProperty(img, "naturalWidth", { value: 800, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 200, configurable: true });
    fireEvent.load(img!);

    expect(frame.style.aspectRatio).toBe("4 / 1");
  });
});

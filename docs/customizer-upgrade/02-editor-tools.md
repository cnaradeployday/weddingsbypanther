# 02 — Editor Tools

**Goal:** turn the customizer from a form with accordions into a real editor, with Zazzle's editor as the UX reference, while respecting each product's constraints.

**Before starting:** read `README.md` (global rules) and `DISCOVERY.md`. Document `01-bug-fixes.md` must be done: this document relies on its persistence (BUG-01), containment (BUG-03) and validation (BUG-02).

**Main visual reference:** `reference/prototype/1-design.png` (and `.html`).

**The editor lives inside the product page**, below the site header, as today. The prototype shows it full screen: keep its structure and behavior, adapted to the product page.

**Dependency on document 03:** document 03 moves technique, quantity and cart into their own steps. Until 03 is implemented, keep technique, AI render preview, quantity, "Add to Cart" and "Buy 1 sample" reachable from the editor (e.g. in a summary panel), so the store keeps working.

---

## Priorities

| Priority | Tasks |
|----------|-------|
| P1 | EDIT-01 Layout (desktop), EDIT-02 Layout (mobile), EDIT-03 Canvas, EDIT-04 Selection and contextual toolbar, EDIT-05 Undo/redo, EDIT-07 Text |
| P2 | EDIT-06 Keyboard, EDIT-08 Date, EDIT-09 Monogram, EDIT-10 Frame, EDIT-11 Logo, EDIT-13 QR code, EDIT-14 Layers, EDIT-15 Alignment and rotation |
| P3 | EDIT-16 Multiple print zones |

EDIT-17 (Accessibility) applies to every task.

---

## EDIT-01 — Editor layout (desktop)

**Reference:** `reference/prototype/1-design.png`, `reference/images/zazzle/Z04-editor-layout-text-selected.png`. Current state: `reference/images/bespoke-current/B01-customizer-overview.png`.

**Current behavior:** a two-column product page. Editing happens in five small accordions; the preview scrolls out of view.

**Expected layout** (inside the product page, below the site header):
- **Editor top bar**: product name and store (the prototype's "Exit" isn't needed inside the product page), step indicator (added in 03; for now it can be omitted), "Saved" status, Undo, Redo, Preview (added in 03) and the primary action.
- **Tool rail** (left, icons with labels): Text, Logo, Frame, Monogram, Date, QR, and Layers at the bottom. Tools a product doesn't allow are hidden for that product.
- **Tool panel** (next to the rail): the options of the selected tool. One panel open at a time.
- **Canvas** (center): the product photo with the design, always visible. Inside the product page this means the editor area fits the viewport height below the site header, or the canvas is sticky while the panels scroll.
- **Views rail** (right): thumbnails of the product photos and the "AI view" entry (see document 03).
- Use the site's existing visual style (serif display type, cream background, violet accent) as in the prototype.

**Acceptance criteria:** at 1280–1440 px wide, the canvas is always visible while using any tool; no accordions remain.

---

## EDIT-02 — Editor layout (mobile)

There are no mobile mockups. Requirements:
- Canvas at the top, taking about half of the viewport height and always visible.
- Tool rail becomes a horizontal bar at the bottom of the screen.
- Tool panels open as bottom sheets over the lower part of the screen, without covering the canvas completely.
- The contextual toolbar (EDIT-04) is docked above the bottom bar instead of floating over the element.
- Pinch to zoom and two-finger pan on the canvas; one finger moves the selected element.
- Handles have a touch hit area of at least 44 × 44 px even if drawn smaller.
- Undo/Redo stay visible in the top bar.

**Acceptance criteria:** the full editing flow works at 375–430 px wide with touch only.

---

## EDIT-03 — Canvas: zoom, guides, grid, snapping and measurements

**Reference:** `reference/prototype/1-design.png` (bottom-left controls), `Z04`.

- **Zoom**: −/+ buttons, a value selector (50%, 75%, 100%, 125%, 150%, 200%, 300%), "Fit", and Ctrl/Cmd + `+`/`−`/`0`. Pinch on touch.
- **Guides** (toggle, on by default): print area (dashed) and safe area (dashed, different color), each with a small label. The safe-area size must come from product configuration; if it doesn't exist, show only the print area and report the gap.
- **Grid** (toggle, off by default).
- **Snapping** while dragging: to the center lines and edges of the print area, and to the centers and edges of other elements. Show the snap line while it's active.
- **Measurements**: keep the live size in cm, shown as a tag next to the selected element (e.g. `8.6 × 1.5 cm`).
- Keep **"Reset positions"** (e.g. in the canvas controls or a menu).

**Acceptance criteria:** zoom doesn't change the design state; guides and snapping work on all products; measurements match the current ones.

---

## EDIT-04 — Selection and contextual toolbar

**Reference:** `reference/prototype/1-design.png` (floating bar above the text), `Z04`.

- Clicking an element selects it: 4 corner handles + rotation handle, and the size tag.
- A **contextual toolbar** appears above the selected element with the actions for its type:
  - Text / Date: font, size (− value +), color, rotation value, align in print area, delete (for elements that can be removed).
  - Logo: replace, crop, remove background, rotation, delete.
  - Monogram / Frame: size, color, rotation, delete.
  - QR: edit URL, size, color, rotation, delete.
- Clicking the empty canvas deselects.
- Handles and toolbar buttons have `aria-label`s (today the handles have none).

**Acceptance criteria:** every element type shows its own toolbar; the toolbar never covers the selected element.

---

## EDIT-05 — Undo / redo

- Buttons in the top bar and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (and Ctrl+Y).
- Every design change is undoable: text, font, size, color, position, rotation, adding/removing elements, frame, monogram, logo edits, lock/hide/reorder.
- Consecutive typing and continuous drags are grouped into one step.
- Redo is disabled when there is nothing to redo (as in the prototype).
- The history is per session; it doesn't need to survive a reload.

**Acceptance criteria:** at least 50 steps; undo after reload is not required; autosave (BUG-01) saves the current state after undo/redo.

---

## EDIT-06 — Keyboard

Today the arrow keys scroll the page instead of moving the element.
- Arrows move the selected element in small steps; Shift + arrows in larger steps.
- Delete/Backspace removes the selected element (when removable).
- Esc deselects.
- Shortcuts are ignored while the focus is in a text input.
- Add a small "Keyboard shortcuts" help (Zazzle has one under Help).

---

## EDIT-07 — Text tool

**Reference:** `reference/prototype/1-design.png` (Text panel), `Z05-font-panel-categories.png`, `Z06-color-panel.png`. Current state: `B01`, `B06-sidney-bag-low-contrast-text.png`.

**Current behavior:** one multi-line field and 6 font cards. No color, numeric size, alignment or spacing. On Sidney Bag, dark text on grey fabric is barely legible.

**Expected behavior:**
- **Text** field (multi-line), as today.
- **Font**: the same 6 fonts, still previewed with the user's own text, grouped with filter chips: All · Script (Great Vibes, Parisienne) · Serif (Cormorant, Playfair, EB Garamond) · Sans serif (Montserrat).
- **Size**: numeric value in cm with −/+ buttons, limited by the print area (BUG-10 feedback at the limit).
- **Color**: free color selection, as in the prototype: current color swatch that opens a color picker, HEX field, eyedropper (only where the browser supports the EyeDropper API; hide it otherwise) and recent colors. **If a technique's configuration restricts colors** (e.g. single-tone laser engraving), show only what the configuration allows. Don't invent color rules; if the configuration doesn't say, report it.
- **Alignment**: left, center, right (for multi-line text).
- **Letter spacing** and **line spacing** sliders.
- **Curve** slider (straight in the middle, arc up/down to each side), as in Zazzle.
- Bold/italic only if the font files already include those styles; don't add font files.

**Acceptance criteria:** all controls update the canvas live and are saved (BUG-01); on Sidney Bag the user can pick a legible color.

---

## EDIT-08 — Date element

- Keep the fixed printed format `MM·DD·YYYY` (BUG-08).
- The date becomes its own element with the same style controls as text (font, size, color, spacing, alignment in area). By default it inherits the names font, as today.

---

## EDIT-09 — Monogram (icons, as today)

**Reference:** `B04-monogram-icons.png`

- Keep the 5 icons (heart, rings, star, flower, diamond) and "None". Do not add initials.
- The icon becomes a normal element: move, resize, rotate, color (subject to technique constraints), delete.

---

## EDIT-10 — Frame as an independent element

**Reference:** `B03-template-frames.png`

**Current behavior:** the frame is attached to the names text, rotates with it and disappears when the text is empty.

**Expected behavior:**
- Keep "None" + the 9 frames.
- The frame is its own element with its own position, size, rotation and color. By default it is placed around the names, like today.
- Emptying the text no longer removes the frame.

---

## EDIT-11 — Logo

**Reference:** `Z08-image-toolbar-and-effects.jpg`, `Z09-remove-white-from-image.jpg`

**Current behavior:** only an "Upload" button; no formats or requirements are shown. Upload was not tested during the review, so first check how it works today.

**Expected behavior:**
- Show accepted formats and requirements **before** uploading, taken from the existing code or configuration. If none are defined, report it.
- Upload progress and clear errors (wrong format, file too large).
- **Low-resolution warning**: compute the effective resolution at the printed size and warn when it is below the threshold. The threshold must come from configuration; if it doesn't exist, report it.
- **Replace** and **Crop** (crop frame with handles).
- **Remove white** with three options, as in Zazzle: Never · Background only · All white.
- **Remove background**: implement it **in the browser**, with no per-use cost (no paid external service). Requirements:
  - Use a library or model that is free for commercial use; state its license and bundle size in the PR.
  - Load it only when the user first clicks "Remove background" and run it without freezing the page (e.g. in a Web Worker), with a progress indicator.
  - Keep the original image: the result can be undone and "Restore original" is available.
  - If the device can't run it (old browser, low memory), show a clear message and keep the original.

---

## EDIT-12 — Upload from phone

**Out of scope for now.** Don't build it.

---

## EDIT-13 — QR code

- A tool to enter a URL, validate it and generate a QR code as a vector element.
- Minimum size: the QR can't be scaled below a minimum scannable size. That minimum must come from configuration (it may depend on the technique); if it doesn't exist, report it.
- Color: dark code on a light background with enough contrast.
- Show a hint to test-scan the code before ordering.

---

## EDIT-14 — Layers

**Reference:** `Z07-layers-panel.png`

- A panel listing all elements (icon/thumbnail and name), in stacking order.
- Drag to reorder; lock (locked elements can't be selected on the canvas) and hide (hidden elements are not printed; show a warning in document 03's Review step).
- Selecting a layer selects the element on the canvas.

---

## EDIT-15 — Alignment and rotation

- Align the selected element to the print area: left, center, right, top, middle, bottom.
- Rotation by exact degrees (input field) in addition to the rotation handle; show the current angle in the contextual toolbar.
- Containment from BUG-03 applies.

---

## EDIT-16 — Multiple print zones (P3)

Every product reviewed has a single print area. If the product data model supports more than one (e.g. front and back), show each zone in the views rail and let the user edit them separately. If it doesn't, leave the editor structure ready for it and report what the data model would need.

---

## EDIT-17 — Accessibility (all tasks)

- Every control is a real `<button>`, `<input>` or `<label>`; visible focus states.
- Icon-only buttons have `aria-label`.
- The canvas selection can be operated with the keyboard (EDIT-06).
- Text contrast ≥ 4.5:1; touch targets ≥ 44 px.

---

## Out of scope for this document

Steps, recovery modal, preview modal, Review step, technique/quantity layout (document 03). New fonts, frames or icons. Upload from phone via QR. Backgrounds, textures, repeat patterns, image filters, magic eraser, social sharing and support chat (reviewed in Zazzle and deliberately discarded).

## Definition of done

- All P1 and P2 tasks meet their acceptance criteria on desktop and mobile, on the 5 products.
- Features not allowed by a product's configuration are hidden for that product.
- Gaps in configuration (safe area, color rules, QR minimum, logo resolution threshold) listed in the PR description.

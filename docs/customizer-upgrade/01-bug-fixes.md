# 01 — Bug Fixes

**Goal:** make the current customizer reliable before adding features. No visual redesign in this document.

**Before starting:** read `README.md` (global rules) and `DISCOVERY.md` (Step 0). If `DISCOVERY.md` doesn't exist, do Step 0 first.

**Products referenced** (all in the store `chris-wedding-planner-266e`): Tote Example, Sidney Bag, Silken Candel, Coaster Bamboo, Sláinte twoinone.

---

## BUG-01 — The design is lost when the page is reloaded

**Priority:** P1 (blocks document 03)

**Current behavior:** the design is shared between products while browsing, but reloading the page or entering the product URL again restores the sample design ("Amelia & Ravi", `06·14·2026`). Only the cart is stored in `localStorage`.

**Expected behavior:**
- The design is saved automatically in browser storage while the user edits, shortly after each change (debounced).
- Reloading or reopening the product restores the last design for that product.
- The current cross-product behavior is kept: fields shared between products today stay shared.
- Build the persistence as a small storage module with a clear interface (e.g. `save`, `load`, `list`, `remove`) and **support several saved versions per product**, because document 03 adds a "Continue your design or start a new one" modal. Saving to a user account is to be defined, so the interface must allow replacing browser storage with a server later without touching the editor.
- Uploaded logos may exceed `localStorage` limits. Choose the right mechanism (e.g. IndexedDB for binary data) and document the choice.
- If storage is unavailable or full, the editor keeps working and the user is not blocked.

**Acceptance criteria:**
- Edit names, font, date, frame, monogram and positions → reload → everything is restored exactly.
- Edit on one product, open another product → shared fields behave as today.
- With storage disabled (private mode, quota exceeded), no errors break the page.

---

## BUG-02 — Items can be added to the cart with the names text empty

**Priority:** P1 · **Reference:** none

**Current behavior:** deleting all the text in "Your names or event text" removes the text (and the frame) from the preview, and "Add to Cart" stays enabled. No message is shown.

**Expected behavior:**
- "Your names or event text" is the only field not marked optional, so it is required.
- When it is empty (after trimming spaces), "Add to Cart" and "Buy 1 sample" are disabled and an inline message under the field explains why (e.g. *"Add your names or event text to continue."*).
- The disabled buttons keep the reason available to screen readers (`aria-describedby`).

**Acceptance criteria:**
- Empty or whitespace-only text → both buttons disabled + visible message.
- Typing any character → buttons enabled, message gone.
- The validation lives in a reusable function (document 03 reuses it in the Review step).

---

## BUG-03 — A rotated element can end up partly outside the print area

**Priority:** P1 · **Reference:** `reference/images/bespoke-current/B02-rotated-element-outside-print-area.png`

**Current behavior:** dragging is correctly limited to the print area, but after rotating (~45°) part of the element sits outside the dashed area, with no warning.

**Expected behavior:**
- Containment is computed on the **rotated** bounding box, for move, resize and rotate.
- After a rotation, if the rotated element no longer fits, move it back inside. If it can't fit at its current size, scale it down to the largest size that fits and show a short non-blocking notice (e.g. *"Resized to fit the print area."*).

**Acceptance criteria:**
- No combination of move, resize and rotate leaves any part of an element outside the print area.
- Covered by unit tests on the containment function.

---

## BUG-04 — The selection box doesn't match the text

**Priority:** P2 · **Reference:** reproduced on Tote Example with long text, and on Silken Candel

**Current behavior:** with long text, the text overflows the selection handles; on Silken Candel the selection box is smaller than the text.

**Expected behavior:** the selection box and handles always match the element's real rendered bounds, including after fonts load, when text wraps, after resizing, and with perspective applied.

**Acceptance criteria:** on all 5 products, with short, long and two-line text, the handles sit on the corners of the visible text.

---

## BUG-05 — Switching thumbnails shrinks the text and hides the measurements

**Priority:** P1 · **Reference:** `B07-candle-thumbnail-without-design.png`, `B08-candle-text-shrunk-after-thumbnail-switch.png`

**Current behavior:** on Silken Candel, after viewing another photo and returning to the lid, the text looks smaller than before and the cm measurements disappear from the accordions.

**Expected behavior:**
- Switching photos never changes the design state. Sizes and positions must be stored independently of the photo being displayed (e.g. in cm or relative to the print area) and converted for each photo.
- Measurements in cm are always visible.

**Acceptance criteria:** switch photos repeatedly on Silken Candel and Coaster Bamboo → the design and measurements are identical when returning to the first photo.

---

## BUG-06 — Names and date overlap in the default position

**Priority:** P2 · **Reference:** Sláinte twoinone

**Current behavior:** with the default design, the names and the date partly overlap on Sláinte.

**Expected behavior:** the default layout is computed from each product's print area so the default elements never overlap and fit inside the print area. "Reset positions" returns to this same non-overlapping layout.

**Acceptance criteria:** on all 5 products, the default design and "Reset positions" produce no overlaps.

---

## BUG-07 — Text stays flat on the curved glass

**Priority:** P3 (investigate first) · **Reference:** `B09-slainte-flat-text-on-curved-glass.png`

**Current behavior:** on Coaster Bamboo the design follows the lid's perspective; on Sláinte the text stays flat instead of following the curve of the glass.

**Expected behavior:**
1. Investigate how per-product perspective is defined and applied (see `DISCOVERY.md`).
2. If the product configuration can describe a curved (cylindrical) surface, render the design with that curvature.
3. If it can't, **don't guess the curvature**: report what configuration data would be needed and leave the task open.

**Acceptance criteria:** either the text follows the glass curvature on Sláinte, or there is a written report of the missing configuration.

---

## BUG-08 — The date is entered in one format and printed in another

**Priority:** P2

**Current behavior:** the date uses the browser's native date picker, which shows the user's locale format (e.g. `14/06/2026`), while the product prints `06·14·2026`.

**Expected behavior:**
- The printed format stays as today (`MM·DD·YYYY`, fixed, not user-selectable).
- The date field shows the date exactly as it will be printed (e.g. a formatted value next to or instead of the native picker), so what the user reads in the form matches the product.

**Acceptance criteria:** with any browser locale, the form shows `06·14·2026` for June 14, 2026, and the preview prints the same.

---

## BUG-09 — A quantity below the minimum is silently corrected

**Priority:** P2 · **Reference:** `B05-quantity-and-cart-preview-out-of-view.png`

**Current behavior:** typing 10 in the quantity field changes it to 25 without any message.

**Expected behavior:**
- Keep the value the user typed and show an inline message (e.g. *"The minimum order is 25 units."*, using the product's minimum from configuration).
- While the value is below the minimum, "Add to Cart" is disabled.
- Presets (25, 50, 100, 200) keep working as today, and the −/+ buttons keep jumping between them (25 → 50 → 100 → 200). This is intended.

**Acceptance criteria:** typing a value below the minimum shows the message and disables Add to Cart; a valid value clears both.

---

## BUG-10 — No feedback when resizing past the maximum size

**Priority:** P3

**Current behavior:** when an element is already at the maximum size that fits the print area, dragging the resize handle does nothing and no message appears.

**Expected behavior:** when a resize hits the limit, show brief feedback near the element (e.g. the size tag reads *"Max size for this print area"*).

**Acceptance criteria:** trying to enlarge an element at maximum size shows the feedback; it disappears when the user releases.

---

## Mobile

All fixes must work with touch: dragging, resizing and rotating with one finger, the validation messages visible without scrolling the preview out of view, and the quantity field usable with the numeric keyboard.

## Out of scope for this document

Visual redesign of the customizer, new tools, steps, undo/redo, keyboard control of elements, color controls (documents 02 and 03).

## Definition of done

- All tasks meet their acceptance criteria on desktop and mobile, on the 5 products listed.
- Tests added for BUG-01, BUG-02, BUG-03, BUG-08 and BUG-09.
- Open questions and gaps reported in the PR description.

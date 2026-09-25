# 03 — Purchase Flow

**Goal:** guide the user from designing to adding to cart in clear steps, with the design always visible, a way to recover saved designs, a proper preview and a review before purchase.

**Before starting:** read `README.md` (global rules) and `DISCOVERY.md`. Documents `01-bug-fixes.md` and `02-editor-tools.md` must be done.

**Visual references:** `reference/prototype/0-recover-saved-design.png`, `2-options.png`, `3-review.png`, and `1-design.png` for the top bar.

---

## Target flow

The editor lives **inside the product page**, as today (decision made). The steps happen within the product page, below the site header.

1. **Product page** opens directly in the customizer, as today.
2. If saved designs exist for the product → **recovery modal** over the product page (FLOW-02).
3. **Step 1 · Design** — the editor from document 02.
4. **Step 2 · Options** — technique, quantity, sample (FLOW-03).
5. **Step 3 · Review** — alerts, summary, AI preview, add to cart (FLOW-05, FLOW-06).

The prototype shows the editor full screen, like Zazzle. Keep its structure and behavior, adapted to the product page.

---

## FLOW-01 — Steps and navigation

**Reference:** top bar in `reference/prototype/1-design.png`, `2-options.png`, `3-review.png`.

- Step indicator in the center of the top bar: `1 Design — 2 Options — 3 Review`. The current step is highlighted; completed steps show a check and are clickable to go back.
- The primary button always names the next step: "Next: Options", "Next: Review". In Review, the primary action is "Add to cart".
- The current step is reflected in the URL (e.g. a `step` query parameter), so reloading keeps the step (with BUG-01 persistence).
- The prototype's "Exit" button is not needed inside the product page; the site header navigation stays available and the design is already saved.
- "Saved" status in the top bar reflects autosave (e.g. "Saving…" / "Saved").
- **Mobile**: a compact indicator ("Step 1 of 3 · Design") and a bottom bar with the total and the primary button.

**Acceptance criteria:** users can move forward and back between steps without losing anything; browser back/forward follows the steps.

---

## FLOW-02 — Saved design recovery

**Reference:** `reference/prototype/0-recover-saved-design.png`, `reference/images/zazzle/Z01-recover-saved-design-modal.png`, `Z03-save-and-exit-menu.jpg`.

- When the user opens a product page and saved designs exist for that product (BUG-01 storage), show a modal over the page: *"Pick up where you left off?"*.
- One row per saved version: thumbnail with the design, the names text, last edited time (relative, e.g. "Edited 20 minutes ago"), technique and quantity. The most recent is preselected.
- Actions: "Continue design" (opens the selected version) and "Start a new one" (creates a new version with the product's default design; old versions are kept).
- Close button: closes the modal and continues with the most recent version.
- If there are no saved designs, the product page opens with the default design, as today.
- Saving to a user account is to be defined; for now versions live in browser storage.

**Acceptance criteria:** with two saved versions, the user can open either one or start a new one; no version is overwritten without the user's action.

---

## FLOW-03 — Step 2 · Options

**Reference:** `reference/prototype/2-options.png`, `Z10-options-variants-with-design-and-price-delta.png`. Current state: `B05-quantity-and-cart-preview-out-of-view.png`.

**Layout:** the product with the design on the left (always visible); options panel on the right; sticky summary at the bottom of the panel.

**Print technique:**
- One card per technique the product offers (from configuration): name, short description, price label ("Included" as today, or the price difference if the pricing data defines one; don't invent prices).
- The descriptions ("what it means: available colors, finish and durability") are written by Panther. If the product or technique data has no field for them, propose one in the PR (don't invent the text). Until Panther provides them, show no description rather than placeholder text.
- Selecting a technique updates the preview **if the renderer supports a different look per technique** (e.g. laser engraving as a single tone). Today the visual difference is minimal or none; if the renderer can't show it, report what's needed.
- Changing technique re-validates the design against that technique's constraints (e.g. colors, QR minimum) and any issue appears in Review.

**Quantity** (pricing as today; don't add discounts):
- Presets 25 / 50 / 100 / 200 as selectable cards, each showing its total (unit price × quantity, e.g. 25 → $260.00 for Tote Example).
- "Other quantity" input with the minimum shown next to it ("Minimum order: 25 units", from configuration) and BUG-09 validation.

**Sample:** "Order 1 sample before production (+$50.00)", as today's "Buy 1 sample". Keep the current behavior and price; only the placement changes.

**Sticky summary:** total, `quantity × unit price`, "Digital proof in 48 h" and the product's production time, plus the button to Review.

**Acceptance criteria:** totals match current pricing for every preset and custom quantity; the design is visible the whole time.

---

## FLOW-04 — Preview modal

**Reference:** `Z11-preview-modal.png`.

- "Preview" button in the top bar, available in every step.
- Opens a large modal with the product photos as thumbnails. Photos with a print-area mapping show the design applied; photos without one are shown as product photos and must not suggest they include the design.
- Click to enlarge; Esc and a close button close it; focus returns to the Preview button.
- **Mobile**: full screen, swipe between photos.

---

## FLOW-05 — AI render preview

- Keep the current feature and its limit (3 per session) and "Render on this photo".
- Place it in the Review step as a block ("AI view · Beta · Close-up and lifestyle photo · N left", with a "Generate" button), and as the "AI view" entry in the views rail of the editor, which opens the same feature.
- Generated images appear in the views rail and in the preview modal, clearly labeled as AI-generated.

---

## FLOW-06 — Step 3 · Review

**Reference:** `reference/prototype/3-review.png`, `Z12-review-step-with-alert.png`.

**Validation engine** (reuse BUG-02, BUG-03 and BUG-09 logic). Three levels:

| Level | Examples | Effect |
|-------|----------|--------|
| Blocking | Names text empty · element outside the print area · quantity below minimum · checklist not confirmed | "Add to cart" and sample disabled until fixed |
| Warning | Element outside the safe area · low-resolution logo · QR below minimum size · color not allowed for the technique · hidden layer | Allowed, but shown |
| Info | Optional logo not added | Informational |

Only use rules backed by configuration or by this package. Rules without data (e.g. safe area if it doesn't exist) are skipped and reported.

**Alerts:**
- Each alert says what's wrong and why it matters (e.g. *"The date is partly outside the safe area. It may get cut off when printed."*).
- Each alert that refers to an element has a "Fix in the design" link: it opens the Design step with that element selected and a badge on it on the canvas (as in Zazzle, `Z12`).
- The same badge is shown on the element in the Review preview.

**Checklist** "Before you confirm" (**mandatory**): *"Names and date spelled correctly"* and *"All elements inside the safe area"*.
- Every item must be checked before "Add to cart" and "Buy 1 sample" are enabled; the disabled buttons explain why.
- If the design changes after the items were checked (e.g. the user goes back to Design and edits), the checks are cleared and must be confirmed again.
- If the product has no safe-area data, the second item reads *"All elements inside the print area"*.

**Summary:** technique, quantity, production time, total and unit price.

**Actions:** "Buy 1 sample (+$50.00)" and "Add to cart" (primary). After adding, keep the current cart confirmation behavior.

**Acceptance criteria:** a blocking issue always prevents adding to cart; every alert link lands on the right element; the summary matches the Options step.

---

## FLOW-07 — Cart

- The cart item must include the full design state (so it can be produced and, later, edited), the technique and the quantity, plus whatever the current flow already sends (check `DISCOVERY.md`). If the current payload lacks the design state, report it before changing it.
- Editing a design from the cart is out of scope unless it already exists.

---

## FLOW-08 — "Goes well with"

Keep it, with the design applied as today, and keep the design shared when the user opens the suggested product. Place it on the product page and/or after adding to cart; don't show it inside the editor steps.

---

## Out of scope for this document

Volume discounts, saving designs to a user account, checkout and payment changes, new products or techniques.

## Definition of done

- The full flow (product page → recovery → Design → Options → Review → cart) works on desktop and mobile for the 5 products.
- No path lets the user add to cart with a blocking issue.
- Checklist items must be confirmed before adding to cart.
- Open questions (per-technique rendering) and configuration gaps listed in the PR description.

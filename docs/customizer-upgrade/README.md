# Bespoke Customizer — Implementation Package

This package contains everything needed to upgrade the product customizer of the Bespoke e-commerce (Panther), live example: `https://weddingsbypanther.vercel.app/store/chris-wedding-planner-266e`.

The work is split into three documents, to be implemented **in this order**:

| # | Document | What it covers |
|---|----------|----------------|
| 1 | `01-bug-fixes.md` | Fixes to the current customizer, design persistence and pre-cart validation. |
| 2 | `02-editor-tools.md` | New editor structure and editing tools (text, color, layers, guides, logo, QR, etc.). |
| 3 | `03-purchase-flow.md` | Step-based flow (Design → Options → Review), saved-design recovery, preview and review before adding to cart. |

Each document can be handed to Claude Code on its own, but they build on each other: 02 assumes 01 is done, and 03 assumes 01 and 02 are done.

## How to use this package with Claude Code

1. Copy this whole folder into the repository (for example `docs/customizer-upgrade/`).
2. Run **Step 0 (Discovery)** below once, before any document.
3. Then give Claude Code one document at a time, e.g.: *"Read `docs/customizer-upgrade/README.md` and `DISCOVERY.md`, then implement `01-bug-fixes.md`. Follow the global rules. Stop and ask when a task depends on information that doesn't exist in the codebase."*
4. Review and merge each document's work before starting the next one.

## Step 0 — Discovery (mandatory, before writing any code)

The people who wrote these documents did **not** have access to the codebase. Nothing here assumes a specific stack, file name, component or data field. Before implementing anything, inspect the repository and write `DISCOVERY.md` next to this README, covering:

1. **Stack**: framework, language, styling approach, state management, test setup, how the app is deployed.
2. **Routes**: where the store, product listing and product/customizer pages live (live URL pattern: `/store/<store-slug>/shop/<product-slug>`).
3. **Customizer code**: the components that render the preview, the accordions (Logo, Template frame, Names or event text, Date, Monogram), the print technique cards, AI render preview, quantity, "Add to Cart" and "Buy 1 sample".
4. **Design state model**: how a design is represented (elements, positions, sizes, rotation, font, date, frame, monogram, logo), and in which units (px, %, cm).
5. **Rendering**: how the design is drawn on the product photo (DOM, SVG, canvas, WebGL), how the print area is mapped onto each photo, and how the automatic perspective/tilt ("each tilts to match the print area automatically") is computed per product.
6. **Product configuration and constraints**: where products are defined and which fields describe print area(s), dimensions, available techniques, colors, fonts, minimum quantity, price, production time and photos. List the exact field names.
7. **Persistence**: what is stored today (currently only the cart in `localStorage`), and how the design is shared between products during navigation.
8. **Cart**: what the add-to-cart payload contains and where it goes.
9. **AI render preview**: how it is called, its session limit (3 per session) and the "Render on this photo" option.
10. **Gaps**: any information the documents below require that does **not** exist in the codebase (for example, a safe-area margin or a per-technique color rule). List them; do not invent values.

## Global rules (apply to all three documents)

- **Product constraints are the source of truth.** Every feature must read the product's existing configuration (print area, techniques, colors, sizes, minimums). Never hard-code a value per product and never invent a constraint. If a feature needs a value that doesn't exist in the configuration, stop and report it as an open question instead of guessing.
- **A feature that a product's configuration doesn't allow is hidden or disabled for that product**, not shown and then rejected.
- **Keep what already works**: live preview on the real product photo, automatic perspective, measurements in cm, elements constrained to the print area, font cards rendered with the user's own text, design shared across products during navigation, "Goes well with", AI render preview and "Buy 1 sample".
- **Keep existing content**: the 6 fonts, the 9 template frames and the 5 monogram icons stay as they are. Adding new fonts, frames or icons is out of scope.
- **The site's UI language is English.** All new copy in English.
- **Desktop and mobile are both in scope.** Each document includes mobile requirements.
- **Accessibility**: real `<button>`/`<input>`/`<label>` elements, visible focus, keyboard support, `aria-label` on icon-only buttons, text contrast ≥ 4.5:1, touch targets ≥ 44 px.
- **Dependencies**: prefer what the project already uses. If a new library is needed (e.g., QR generation), justify it in the PR description.
- **Tests**: add or update tests for every bug fix and for the validation logic.
- **Don't change pricing, checkout or payment logic** unless a task explicitly says so.

## Decisions already made

| Topic | Decision |
|-------|----------|
| Monogram | Keep the 5 icons as today (no initials). |
| Date format | Keep the fixed printed format as today (`MM·DD·YYYY`, e.g. `06·14·2026`). |
| Volume discounts | Keep pricing as today. Do not add discounts. |
| Design saving | Browser storage for now. Saving to a user account is **to be defined**: build the storage layer so it can be swapped later. |
| Mobile | In scope. There are no mobile mockups; follow the mobile requirements in each document. |
| Quantity −/+ buttons | Keep jumping between presets (25 → 50 → 100 → 200), as today. |
| Where the editor lives | Inside the product page, as today. The prototype shows it full screen; adapt it to the product page (see 02 and 03). |
| Review checklist | Mandatory: every item must be checked before adding to cart. |
| Technique descriptions | Written by Panther (the product owner). |
| Logo background removal | In-browser solution, with no per-use cost. |
| Upload from phone (QR) | Out of scope for now. |

## Reference material

```
reference/
  prototype/        Target design (desktop). Static HTML + PNG of each screen.
    0-recover-saved-design   Modal to continue a saved design or start a new one
    1-design                 Editor: tool rail, text panel, contextual toolbar, guides, zoom, views
    2-options                Technique, quantity and sample, with sticky summary
    3-review                 Alerts linked to elements, checklist, AI preview, add to cart
  images/
    bespoke-current/  B01–B09: screenshots of the current customizer and its bugs
    zazzle/           Z01–Z12: screenshots of the Zazzle editor used as the UX reference
```

Short references in the documents (for example `B07` or `Z04`) point to the file with that prefix in `reference/images/`.

About the prototype:
- It is a **static** visual reference, not code to copy. It shows the editor full screen; in Bespoke it must live **inside the product page**, below the site header. Open the `.html` files in a browser (they need internet for Google Fonts) or look at the `.png` files.
- Sample content is illustrative: the second saved design ("Sofi & Tomás"), the recent colors and the alert shown in Review are examples. Prices and times come from Tote Example.
- `[What it means: available colors, finish and durability]` is a placeholder: the technique descriptions must be supplied by the product owner.
- The Zazzle screenshots show Zazzle's interface in Spanish, because the benchmark was done on the Spanish version of the site. They are there for layout and behavior, not copy.

## Glossary

- **Print area**: the region of the product where the design can be printed (dashed line in the current preview).
- **Safe area**: an inner margin of the print area where content is guaranteed not to be cut. Its size must come from the product configuration; if it doesn't exist, report it as a gap.
- **Element**: any item on the design (names text, date, frame, monogram, logo, QR).
- **Technique**: print technique offered for a product (UV print, Laser engrave, Screen print).

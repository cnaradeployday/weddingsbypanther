# DISCOVERY — Bespoke Customizer

Step 0 discovery for the 3-document customizer upgrade package (`README.md`, `01-bug-fixes.md`, `02-editor-tools.md`, `03-purchase-flow.md`). All citations are `path:line` against the current working tree (branch `claude/gallant-albattani-exrw56`).

## How this was produced

Code discovery (sections 1–10) was done by reading the source directly and cross-checking every claim against the file/line cited. Live reproduction of the 9 bugs in a running browser was **not completed** — see "Testing environment" below — so the bug root causes in §10 are derived from static code reading, not from watching the bug happen. They should be treated as high-confidence but not yet visually confirmed.

## Testing environment (read before starting any document)

**Root cause identified — this is an environment network-policy restriction, not a code bug.** This session's outbound network policy denies both `weddingsbypanther.vercel.app` (the live site) and `fqomygvhtdocfnisasrb.supabase.co` (the project's own Supabase instance) at the egress proxy (confirmed via `connect_rejected` / 403 in the proxy's own failure log for both hosts). Concretely:

- The live site can't be reached at all from this environment.
- A local `next dev` **can** run and **can** serve pages (see below), but every server-side Supabase read (`getPlannerBySlug` etc. in `src/lib/queries.ts`) silently fails and returns `null` — because the Next.js server itself can't reach `fqomygvhtdocfnisasrb.supabase.co` either — which makes every `/store/[slug]/...` route 404 via `notFound()`. This is **not** an RLS or data problem: the `chris-wedding-planner-266e` planner row exists, is `status = 'approved'`, and its `planners` table has a public-select RLS policy (`qual: true`) — confirmed directly via the Supabase MCP connector (which reaches Supabase through a separate, permitted channel, unlike this container's own outbound network).
- A real (and separate, now-resolved) issue was found along the way: Turbopack's dev-mode font fetch for `next/font/google` also fails in this environment (surfacing as `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` / `next/font/google queries have exactly one entry`, from `src/app/layout.tsx`'s 14 font calls), blocking every route from compiling. Running `next dev --webpack` avoids it entirely (`✓ Ready`, pages compile). This looks like a sandbox-only quirk in Turbopack's Rust-side font fetcher and is very unlikely to affect Vercel or a normal developer machine, so no code change is proposed for it — noted here only so it isn't mistaken for the real blocker if someone retries `next dev` here.
- **Fix**: this needs the environment's network access widened (broader access level, or `fqomygvhtdocfnisasrb.supabase.co` added to allowed domains) via the cloud environment's settings — not something fixable from inside the session. Until then, in this environment: no live-browser/visual verification against real Supabase data is possible, for either the deployed site or a local dev server.
- **What still works without it**: reading and reasoning about the code (this document), and any test that doesn't need Supabase — pure-function unit tests (Vitest, once added) against `quadGeometry.ts`, date formatting, the new validation module, etc., and component tests that mount `ProductConfigurator` with a hand-built mock `product` prop (it's a plain prop, no fetch inside the component itself) instead of real data.
- No automated way was found to enumerate the 5 named products' exact slugs (Tote Example, Sidney Bag, Silken Candel, Coaster Bamboo, Sláinte twoinone) — confirm those once Supabase access is available, or ask Panther directly.

---

## 1. Stack

- **Framework**: Next.js 16.3.1, App Router. React 19.2.8 / react-dom 19.2.8. (`package.json:1-24`)
- **Language**: TypeScript 5, `strict: true` (`tsconfig.json`).
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`). No CSS Modules — all styling is Tailwind utility classes inline in JSX, plus small inline `style={{...}}` objects for computed geometry (position/rotation/font-size in the customizer).
- **State management**: plain React `useState`/`useRef`/`useMemo`/`useCallback`. No `useReducer`, no Redux/Zustand/Jotai, no React Context for design state (Context is used only for the cart — `src/lib/cart.tsx`). `ProductConfigurator.tsx` alone declares ~20 independent `useState` hooks for the design.
- **Tests**: **none exist in the repo.** No test runner in `package.json` (`dependencies`/`devDependencies` — no jest/vitest/@playwright/test/mocha), no `test` script, no `*.test.*`/`*.spec.*` files anywhere, no `playwright.config.*`, no `e2e/` folder. **Any "add tests" acceptance criterion in the three documents needs a test runner introduced first** — flagged as a gap (§ Gaps).
- **Deployment**: Vercel. `next.config.ts` whitelists a Supabase storage hostname for `next/image` and sets `serverExternalPackages: ["potrace"]` specifically to work around Turbopack bundling on Vercel. `src/lib/personalizationComposite.ts:90-125` has a comment block about generating a `fontconfig` file at runtime because Vercel's serverless Node runtime ships with no fonts — further confirmation of the Vercel target. Package manager: npm (`package-lock.json`, no other lockfile).

## 2. Routes

- Product/customizer page: `src/app/store/[slug]/shop/[product]/page.tsx` — `[slug]` = planner/store slug, `[product]` = product slug, matching the live pattern `/store/<store-slug>/shop/<product-slug>`.
- The page is a server component: it fetches the product + related products server-side (`getStorefrontProduct`, `getRelatedProducts` in `src/lib/queries.ts`) and renders `<ProductConfigurator product={...} relatedProducts={...} unlimitedRenders={...} />` with the full product/zone/technique/variant/image data passed as one prop — no client-side fetch on initial load.
- `unlimitedRenders` (the AI-render session cap bypass) is derived server-side from `session?.profile.role === "admin"`.
- Cart: `src/app/store/[slug]/cart/page.tsx`. Checkout: `src/app/store/[slug]/checkout/page.tsx` (wraps client `CheckoutForm`).
- `CartProvider` (scoped per planner slug) wraps the whole `/store/[slug]` subtree in `src/app/store/[slug]/layout.tsx` — cart state, not design state, is shared across every product page under one store via one `localStorage` key per planner.

## 3. Customizer code

Everything lives in **`src/components/ProductConfigurator.tsx`** — 1973 lines, one file, no sub-components extracted for the tool panels. Rough map:

- Types & constants (1–113): `Zone`, `ElemKey`, `ZoneDesign` (the full design shape, see §4), `DEFAULT_POSITIONS` (240-245, one hardcoded layout used for every product — see BUG-06 in §10).
- Small render helpers (120-234): `ResizeIcon`/`RotateIcon`/`ChevronIcon`, `CollapsibleSection` (the accordion primitive — every section defaults to **closed**), `AdjustHandles` (the 4-corner + rotate handle, drawn only on the currently-selected element).
- Design state (278-433): names/date/monogram/frame/textFont/logo(File/Preview)/inkColor/positions/elemScale/elemRotationOffset/elemOrder/activeElem, plus a per-zone snapshot map (`zoneDesignsRef`, a `useRef`, not `useState`) so switching print *zones* on multi-zone products doesn't lose work.
- Geometry (538-865): `zoneBox` (bounding box of the print zone's quad), `zonePoints` (SVG outline), `autoRotationDeg` (auto-tilt from the zone's own quad), `quadCornersPx`, pointer-event drag/resize/rotate handlers, font-size fitting, logo DPI check.
- Cart submission (1173-1308): `submitToCart(sample)`, shared by "Add to Cart" and "Buy 1 sample".
- Render tree (1310-1973), in this order:
  1. Photo + live DOM overlay (1314-1486).
  2. Thumbnail strip (1487-1505) + `RelatedProductsRail` ("Goes well with", 1506-1519).
  3. Title/price/description (1522-1534), variant picker (1536-1561).
  4. `product.personalizable` block (1563-1825): print-zone selector when >1 zone, then the 5 accordions **in this order**: Your logo → Template frame → Your names or event text (incl. font picker) → Date (native `<input type="date">`) → Monogram, plus "Reset positions".
  5. Print technique cards (1827-1849, only if `product.techniques.length > 0`).
  6. `<AiRenderPanel>` (1851-1870, only if `product.personalizable && product.aiRenderEnabled`).
  7. Quantity input (1872-1923): +/- buttons, free-text number field, preset chips.
  8. "Add to Cart" (1925-1939) → `handleAddToCart` → `submitToCart(false)`.
  9. "Buy 1 sample" (1940-1952, gated by `product.allowSample`) → `submitToCart(true)`.
  10. Merchandise-only `QuoteRequestForm`, "View cart →" link.

## 4. Design state model

```ts
type ElemKey = "logo" | "monogram" | "names" | "date";
type ElemPos = { x: number; y: number };

type ZoneDesign = {
  names: string;
  date: string;                 // ISO "YYYY-MM-DD" — native <input type="date"> value
  monogram: string;             // MonogramId | ""
  frame: string;                // FrameId | ""
  textFont: string;             // TextFontId
  logoFile: File | null;
  logoPreview: string | null;   // data: URL
  inkColor: string;             // hex — only meaningful for single-color-ink techniques
  colorTextInput: string;
  positions: Record<ElemKey, ElemPos>;          // x/y in 0–100, % of the ZONE's bounding box
  elemScale: Record<ElemKey, number>;           // multiplier, default 1
  elemRotationOffset: Record<ElemKey, number>;  // degrees, ADDED to the zone's own auto-tilt
  elemOrder: ElemKey[];                          // z-order, front = last
};
```

- **Units**: `positions` are **percent (0–100) of `zoneBox`** — the axis-aligned bounding box of the print zone's `corners_pct` 4-point quad (`ProductConfigurator.tsx:546`) — not the full photo, and not mm/px.
- **Font sizes / logo width are derived, not stored.** `nameFontPx`/`monogramFontPx`/`dateFontPx`/`logoWidthPct` are recomputed every render from `zone.width_mm`/`height_mm` (real print-area mm) and the *currently measured on-screen pixel size* of the zone box (`zoneSize`, from a `ResizeObserver`). `mmPerPx = zone.width_mm / zoneSize.width`. This dynamic, screen-size-dependent conversion (not cached) is central to BUG-05 (§10).
- **Rotation** is two-part: `autoRotationDeg` (from the zone quad's own tilt) + a user-adjustable `elemRotationOffset[key]` (clamped to ±45° in the rotate-handle drag handler) → combined into the element's final rotation.
- **Server-side mirror** of the same model exists in `src/lib/personalizationComposite.ts` (composite render) and `src/lib/personalizationOutline.ts` (print-ready vector export, 300 DPI, real mm) — both re-derive px from the same `positions` percentages against the zone's real mm dimensions, so the print file is dimensioned in true physical units even though the on-screen editor state is percentage-based.
- **Cart payload** carries the same fields flattened (no absolute px/mm ever persisted) — see §8.

## 5. Rendering

- **DOM, absolute-positioned `<div>`s over a `next/image`**, not canvas/SVG/WebGL for the live preview. The print zone outline is an SVG polygon overlay (`viewBox="0 0 100 100"`). Each element (logo/monogram/names/date) is an `absolute`-positioned `<div>` inside a wrapper sized to `zoneBox`, positioned with `left/top: {pos}%` + `transform: translate(-50%,-50%) rotate(...)`.
- **Server-side raster compositing** (AI render, cart snapshot, related-product quick-add) uses **`sharp`**: builds an SVG string, rasterizes it, then multiply-blends it onto the real product photo (`personalizationComposite.ts`).
- **Print-ready export** (`personalizationOutline.ts`) produces true SVG/PDF `<path>` outlines via `opentype.js` (text) and `potrace` (logo vectorization), sized in real mm, at 300 DPI.
- **Print area**: admin tool `PrintAreaTool.tsx` lets an admin drag a **4-corner freeform quad** (`[TL, TR, BR, BL]`, percent-of-photo) per reference photo; `ProductAreasEditor.tsx` wraps this per zone, with multiple zones already supported per product.
- **Perspective/tilt — directly relevant to BUG-07**: `src/lib/quadGeometry.ts` is **strictly a planar 4-point quad model**. `quadUV` explicitly treats the quad as a **parallelogram** using only 3 of the 4 corners (`TL, TR, BL` — `BR` is ignored by design, per the comment at `quadGeometry.ts:11-20`), and every containment/clamp helper (`clampPointToQuad`, `clampOrientedBoxToQuad`, `maxOrientedBoxScale`) treats the print area as a convex 4-straight-edge polygon. `ProductConfigurator.tsx:78-80` states outright: *"the live CSS preview shows the bounding box of the (possibly angled/trapezoidal) print area rather than attempting a true perspective warp — the AI render is what shows the accurate, perspective-correct result."* Both the live preview and the server-side composite ultimately reduce a zone's shape to **one rigid rotation angle** derived from the TL→TR edge, applied to a flat rectangle.
- **There is no cylindrical/curved-surface primitive anywhere in the codebase.** `product_print_zones.corners_pct` is a flat 4-point JSON array; there's no "shape" field, no per-edge curvature, no radial/multi-segment mapping. A repo-wide search for curvature/warp-related terms turns up only Bezier-curve tracing code (unrelated) and the explicit "we approximate, we don't warp" comments above. **This directly answers BUG-07's investigation step**: the gap isn't a missing config value on one product, it's a missing geometry primitive in `quadGeometry.ts` — see § Gaps.

## 6. Product configuration schema (Supabase — `src/lib/database.types.ts`)

- **`products`**: `id, slug, name, description, factory_price, min_order, popular_qty, allow_sample, lead_time_days_min, lead_time_days_max, personalizable, category_id, supplier_id, related_product_ids[], reviewer_note, sku, status, stock_on_hand, style_tags[]`. No safe-area field.
- **`product_images`**: `id, product_id, url, sort_order`.
- **`product_print_zones`** (the print-area table): `id, product_id, label, corners_pct (Json, 4-point array), width_mm, height_mm, width_pct, height_pct, pos_x_pct, pos_y_pct, rotation_deg, max_chars_per_line, max_lines, image_id, extra_price, sort_order`. **Multiple zones per product are already fully modeled and already used** — `sort_order = 0` is the primary zone by convention (`queries.ts`), and the customizer already has `activeZoneId`/`selectedExtraZoneIds` state driving a working secondary/tertiary-area UI. Note: `width_pct/height_pct/pos_x_pct/pos_y_pct/rotation_deg` exist as columns but are **not selected anywhere** in `queries.ts` — only `corners_pct` and the mm dimensions are read; these four look like leftovers from an earlier, non-quad zone model.
- **`product_print_techniques`**: `id, product_id, technique (name, joined against print_techniques.name), extra_price, is_default`.
- **`print_techniques`** (technique catalog): `id, name, finish_description, color_mode_description, single_color_ink (bool), single_color_fill_mode ("silhouette"|"reference"), strip_source_color (bool), sort_order`. This is the *only* per-technique color-restriction data that exists: a technique is either free-color or locked to `TECHNIQUE_INK_COLOR[name]` (`src/lib/printTechniqueColors.ts`) — there's no enumerated allowed-colors list or Pantone restriction set.
- **`product_variants`**: `id, product_id, label, sku, price_delta, image_url, sort_order, stock_on_hand`.
- **`planners`**: storefront/tenant config incl. `ai_render_enabled`, `default_markup_pct`, theming — no per-planner override of the AI-render session cap.
- **`order_items`**: `personalization (Json | null)` — the whole design payload is stored as one opaque JSON blob on the order line, not normalized columns.

**Searched for and confirmed absent** (schema + repo-wide grep):
- **Safe-area margin**: none, anywhere. `02-editor-tools.md`/`03-purchase-flow.md` both need this and both already say "report it as a gap" if missing — **it's missing**.
- **QR minimum-size config**: no QR feature exists in the codebase at all yet (no generation, no constant).
- **Logo resolution/DPI threshold**: this *does* exist, but as a global hardcoded constant, not per-product/technique config — `MIN_PRINT_DPI = 150` in `src/lib/logoPrintQuality.ts`, applied uniformly regardless of technique.

## 7. Persistence today

- **Cart**: `localStorage`, key `` bespoke-cart:${plannerSlug} `` (`src/lib/cart.tsx`) — one cart per store, hydrated on mount, written on every change.
- **AI render usage counter**: `sessionStorage`, key `` bespoke-ai-renders:${productId} ``.
- **Cross-product handoff** (the only existing cross-page persistence of *design* data): `sessionStorage`, single fixed key `"bespoke:personalizationHandoff"` — write-once on an explicit "click a related product" action, read-once-and-cleared into the next page's initial state. This is a one-shot action-triggered handoff, **not** an ongoing draft save.
- **The design itself (names/date/monogram/frame/logo/positions/scale/rotation) is never persisted to any storage as an ongoing draft.** It lives purely in `ProductConfigurator`'s React state and is lost on reload or re-entering the URL — this is the exact, confirmed root cause of BUG-01. Within one page, switching between multiple print *zones* (not products) uses an in-memory `useRef` map, also not persisted.

## 8. Cart

- `CartItem` (`src/lib/cart.tsx`) **does already carry the full design state**: `personalization` includes `zoneId, names, date, monogram, frame, textFont, technique, extraPrice, elemScale, elemRotationOffset, positions, hasLogo, renderUrl, renderContextUrl, snapshotUrl, inkColorHex, inkPantoneCode, logoVector, additionalAreas[]` (secondary/tertiary zones, same shape). Quantity and technique are both included. FLOW-07's "if the current payload lacks the design state, report it" — **it does not lack it; no gap here.**
- `addItem` merges by a `key` built from productId+variantId+names+date+monogram+frame+techniqueId+extraAreas — identical configurations sum quantity, anything else appends a new line.
- **Order creation is client-side, direct-to-Supabase**, not via a server API route: `CheckoutForm.tsx` inserts an `orders` row then one `order_items` row per cart line straight from the browser using the anon Supabase client, relying on RLS (`orders.customer_id = auth.uid()`). There is no `POST /api/orders` route — only `api/orders/[id]/receipt`.
- Cart-page quantity editing has the same "silently clamp to minOrder" pattern as BUG-09 (`cart.tsx`'s `updateQuantity`) — worth fixing in the same pass even though the task doc only calls out the product page.

## 9. AI render preview

- `AiRenderPanel.tsx` posts to `POST /api/ai-render` with the current design state + `imageId`/`zoneId`.
- **The "3 per session" cap is entirely client-side** (`sessionStorage`, key `` bespoke-ai-renders:${productId} ``, `MAX_RENDERS_PER_PRODUCT = 3`), trivially reset by clearing storage, a private window, or personalizing a different product. `src/app/api/ai-render/route.ts` has **no server-side rate limiting or counting of its own** — confirmed by reading the full route.
- "Render on this photo": when a product has multiple images, a thumbnail picker sets which reference photo (`imageId`) the render is composited against.
- Pipeline is two-pass and deliberately avoids letting an image model touch the customer's actual text/logo: (1) deterministic `sharp` composite of the real personalization onto the real photo, (2) a separate Gemini (`gemini-2.5-flash-image`) call generates an *empty* lifestyle background with no product/text, which is then deterministically composited with the already-personalized product photo. Requires `GEMINI_API_KEY`; 503s without it.

## 10. Known bug locations (static analysis — not yet visually confirmed, see "Testing environment")

- **BUG-01 (design lost on reload)** — confirmed by §7: zero write-through to storage for design state; only the one-shot handoff exists, and it doesn't fire on reload.
- **BUG-02 (empty names doesn't block Add to Cart)** — confirmed: `ProductConfigurator.tsx:1932-1938`'s Add to Cart button is `disabled={addingToCart}` only, no check on `names.trim()`. `submitToCart` never early-returns on an empty required field. The only place emptiness is checked is inside `buildAreaResult`'s `hasContent`, and that only gates whether a snapshot image is generated — not the cart add.
- **BUG-03 (rotated element can exit the print area)** — confirmed: `clampOrientedBoxToQuad` is called from the **move**-drag pointermove handler (`ProductConfigurator.tsx:613-649`, line 627) but the **rotate**-handle pointermove handler (`688-713`, the `else` branch at 697-701) only clamps the rotation angle itself to ±45° and never re-runs any boundary check against the element's rotated footprint at its (unchanged) position afterward. The clamp function itself is rotation-aware (it takes a rotation argument) — it's simply never invoked from the rotate gesture.
- **BUG-04 (selection box doesn't match text)** — likely two contributing causes, not fully isolated without a live repro: (a) when a frame is active, the frame SVG is a *sibling* positioned outside the text-only wrapper that `AdjustHandles` outlines, so the dashed box doesn't include the frame's visible extent; (b) multi-line names use `items-center` in an auto-width flex column, so the box width = the widest line while shorter lines center inside it, which can look like a mismatch for uneven multi-line text. **Needs a live repro to confirm which (or both) the bug report means** — flagged as an open question.
- **BUG-05 (switching photos shrinks text / hides cm)** — confirmed, precise mechanism: the whole personalization overlay (including the `zoneRef` div that `ResizeObserver` measures for `zoneSize`) is gated behind `showOverlayHere = !zone?.image_id || product.images[activeImage]?.id === zone.image_id`. Clicking a thumbnail only calls `setActiveImage(i)`, not any zone-switch — so navigating to a photo that isn't this zone's own reference photo **unmounts** the zone overlay entirely, `zoneSize` resets to `{0,0}`, `mmPerPx` becomes `null`, every "≈ N×M cm" label disappears, and every font-size calc falls back to a flat non-proportional default (e.g. names falls back to `18 * elemScale.names` instead of the zone-proportional size) — which reads as "text shrunk" whenever that flat fallback is smaller than the real zone-proportional value.
- **BUG-06 (default names+date overlap)** — confirmed: `DEFAULT_POSITIONS` (`ProductConfigurator.tsx:240-245`) is one hardcoded `{x,y}` set — a fixed 17-percentage-point vertical gap between names (`y:65`) and date (`y:82`) — used identically for every product regardless of its zone's aspect ratio or the font sizes that zone's real mm dimensions will produce. On a short/squat zone, the derived font sizes can exceed that fixed gap. There is no anti-overlap check anywhere.
- **BUG-07 (flat text on curved glass)** — see §5: this is a genuine geometry-model gap, not a missing per-product config value. `quadGeometry.ts` has no representation for a curved surface at all.
- **BUG-08 (date input format)** — confirmed and narrower than it first reads: the live **preview** already formats correctly (`formattedDate` builds `MM·DD·YYYY` via `toLocaleDateString("en-US", ...)` then swaps `/` for `·`). The bug is isolated to the raw `<input type="date">` control itself (`ProductConfigurator.tsx:1767-1772`), whose on-screen day/month/year order is rendered by the browser/OS per locale and can't be restyled via props/CSS — it needs a custom-formatted display value (e.g. a read-only formatted text overlay, or a fully custom date field) alongside or instead of the native picker.
- **BUG-09 (quantity below minimum silently corrected)** — confirmed, and it's the same pattern in two places: `commitQuantityInput` on the product page, and `useCart().updateQuantity` on the cart page — both do `Math.max(minOrder, parsed)` with zero error UI.

---

## Gaps (things the documents need that don't exist in the codebase — do not invent values for these)

1. **Safe-area margin.** No field anywhere (product, zone, or technique) describes an inner safe margin. `02-editor-tools.md` EDIT-03 and `03-purchase-flow.md` FLOW-06 both already anticipate this and specify a fallback ("show only the print area" / "the checklist item reads 'inside the print area'"); follow that fallback rather than inventing a margin.
2. **QR minimum scannable size.** No QR feature exists yet at all (EDIT-13 is new work), so there's no existing minimum-size constant to reuse either — this needs a value from Panther, or a documented default with the assumption stated in the PR.
3. **Per-technique allowed-color list.** `print_techniques.single_color_ink`/`single_color_fill_mode` only distinguish free-color vs. one fixed ink color (`printTechniqueColors.ts`) — there's no enumerated "these 4 colors only" list for any technique. EDIT-07's "if a technique's configuration restricts colors, show only what the configuration allows" has exactly one restriction shape available today (fully free, or fully fixed to one color); anything more granular needs new config.
4. **Logo resolution/DPI threshold is global, not per-technique/per-product.** `MIN_PRINT_DPI = 150` (`logoPrintQuality.ts`) is a single constant. EDIT-11 can reuse it as-is (it's already computed against the real printed size via zone mm), but if Panther wants it to vary by technique, that's new config.
5. **Curved/cylindrical print surfaces are not representable at all** (BUG-07) — not a missing parameter on one product, a missing geometry primitive. Implementing true curvature (e.g. for Sláinte's glass) means adding a new surface-shape concept to `product_print_zones` and a new rendering path in `quadGeometry.ts`/`personalizationComposite.ts`/`personalizationOutline.ts`, not a config tweak.
6. **No test runner exists in the project at all.** Every "add tests" acceptance criterion (BUG-01, 02, 03, 08, 09) needs a test framework introduced first (nothing in `package.json` today — no jest/vitest/@playwright/test). Recommend a lightweight unit-test runner (e.g. Vitest) for the pure functions this package touches (`quadGeometry.ts`, the new validation module, date formatting) — worth deciding explicitly before `01-bug-fixes.md` starts, since its Definition of Done requires tests.
7. **This environment's network policy blocks both the live site and this project's own Supabase instance**, so no live-browser visual verification is possible here until network access is widened (see "Testing environment"). Not fixable from inside the session — needs the environment's network settings changed, or this work verified outside this sandbox.
8. **`product_print_zones.width_pct/height_pct/pos_x_pct/pos_y_pct/rotation_deg`** exist as unused columns (not selected in `queries.ts`, not read by the customizer). Not a blocker for anything in the three documents, but worth a one-line note in the PR in case they're meant to replace `corners_pct` eventually and were just never wired up — flagging rather than silently building on top of `corners_pct` without mentioning it.
9. **Exact slugs for the 5 named products** (Tote Example, Sidney Bag, Silken Candel, Coaster Bamboo, Sláinte twoinone) were not confirmed against a live listing — see "Testing environment".

import { describe, it, expect } from "vitest";
import {
  IndexedDbDesignStorage,
  SafeDesignStorage,
  LATEST_VERSION_ID,
  type SavedDesign,
  type DesignStorageBackend,
} from "./designStorage";

function makeDesign(overrides: Partial<SavedDesign> = {}): SavedDesign {
  return {
    productId: "product-1",
    versionId: LATEST_VERSION_ID,
    updatedAt: Date.now(),
    activeZoneId: "zone-1",
    selectedExtraZoneIds: [],
    techniqueId: "uv-print",
    variantId: "",
    quantity: 25,
    zones: {
      "zone-1": {
        names: "Amelia & Ravi",
        date: "2026-06-14",
        monogram: "heart",
        frame: "laurel",
        textFont: "greatvibes",
        logoFile: null,
        logoPreview: null,
        inkColor: "#1a1a1a",
        colorTextInput: "",
        positions: { names: { x: 50, y: 65 }, date: { x: 50, y: 82 }, monogram: { x: 50, y: 15 }, logo: { x: 50, y: 35 } },
        elemScale: { names: 1, date: 1, monogram: 1, logo: 1 },
        elemRotationOffset: { names: 0, date: 0, monogram: 0, logo: 0 },
        elemOrder: ["logo", "monogram", "names", "date"],
      },
    },
    ...overrides,
  };
}

// The module under test caches one IndexedDB connection for its whole
// lifetime (matching how it's actually used — one page, one connection), so
// tests share a single fake-indexeddb database (installed globally by
// vitest.setup.mts) rather than getting a fresh one each time. Each test
// below uses its own productId/versionId combination instead, so they stay
// independent without relying on the module resetting between them —
// exactly as separate real products/browser sessions would never collide
// with each other either.

describe("IndexedDbDesignStorage", () => {
  it("round-trips every field of a saved design, including nested positions", async () => {
    const storage = new IndexedDbDesignStorage();
    const design = makeDesign({ productId: "round-trip-product" });
    await storage.save(design);
    const loaded = await storage.load(design.productId, design.versionId);
    expect(loaded).toEqual(design);
  });

  it("returns null for a design that was never saved", async () => {
    const storage = new IndexedDbDesignStorage();
    const loaded = await storage.load("nonexistent-product", LATEST_VERSION_ID);
    expect(loaded).toBeNull();
  });

  it("keeps different products' saved designs independent", async () => {
    const storage = new IndexedDbDesignStorage();
    const base = makeDesign();
    await storage.save({ ...base, productId: "product-a", zones: { z: { ...base.zones["zone-1"], names: "A" } } });
    await storage.save({ ...base, productId: "product-b", zones: { z: { ...base.zones["zone-1"], names: "B" } } });
    const a = await storage.load("product-a", LATEST_VERSION_ID);
    const b = await storage.load("product-b", LATEST_VERSION_ID);
    expect(a?.zones.z.names).toBe("A");
    expect(b?.zones.z.names).toBe("B");
  });

  it("overwrites the same (product, version) on a second save", async () => {
    const storage = new IndexedDbDesignStorage();
    const productId = "overwrite-product";
    await storage.save(makeDesign({ productId, quantity: 25 }));
    await storage.save(makeDesign({ productId, quantity: 100 }));
    const loaded = await storage.load(productId, LATEST_VERSION_ID);
    expect(loaded?.quantity).toBe(100);
  });

  it("removes a saved design", async () => {
    const storage = new IndexedDbDesignStorage();
    const productId = "remove-product";
    await storage.save(makeDesign({ productId }));
    await storage.remove(productId, LATEST_VERSION_ID);
    expect(await storage.load(productId, LATEST_VERSION_ID)).toBeNull();
  });

  it("lists saved versions for a product, newest first, as lightweight summaries", async () => {
    const storage = new IndexedDbDesignStorage();
    const productId = "list-product";
    await storage.save(makeDesign({ productId, versionId: "v1", updatedAt: 1000 }));
    await storage.save(makeDesign({ productId, versionId: "v2", updatedAt: 2000 }));
    const list = await storage.list(productId);
    expect(list.map((s) => s.versionId)).toEqual(["v2", "v1"]);
    expect(list[0]).toMatchObject({ productId, names: "Amelia & Ravi", quantity: 25 });
  });

  it("supports several saved versions per product independently", async () => {
    const storage = new IndexedDbDesignStorage();
    const productId = "multi-version-product";
    await storage.save(makeDesign({ productId, versionId: "v1", quantity: 25 }));
    await storage.save(makeDesign({ productId, versionId: "v2", quantity: 50 }));
    expect((await storage.load(productId, "v1"))?.quantity).toBe(25);
    expect((await storage.load(productId, "v2"))?.quantity).toBe(50);
  });
});

describe("SafeDesignStorage — BUG-01 fail-soft behavior", () => {
  const alwaysFails: DesignStorageBackend = {
    save: () => Promise.reject(new Error("quota exceeded")),
    load: () => Promise.reject(new Error("db unavailable")),
    list: () => Promise.reject(new Error("db unavailable")),
    remove: () => Promise.reject(new Error("db unavailable")),
  };

  it("never rejects when the backend throws — the editor must keep working", async () => {
    const safe = new SafeDesignStorage(alwaysFails);
    await expect(safe.save(makeDesign())).resolves.toBeUndefined();
    await expect(safe.load("p", "v")).resolves.toBeNull();
    await expect(safe.list("p")).resolves.toEqual([]);
    await expect(safe.remove("p", "v")).resolves.toBeUndefined();
  });

  it("passes through a working backend's real results unchanged", async () => {
    const safe = new SafeDesignStorage(new IndexedDbDesignStorage());
    const design = makeDesign({ productId: "safe-wrapper-product" });
    await safe.save(design);
    expect(await safe.load(design.productId, design.versionId)).toEqual(design);
  });
});

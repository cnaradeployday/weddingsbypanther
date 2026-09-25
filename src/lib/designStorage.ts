// Design persistence — BUG-01. A small, storage-agnostic interface
// (save/load/list/remove) so a later server-backed implementation (saving to
// a user account, per the package's "to be defined" note) can replace the
// browser-storage one below without the editor changing at all.
//
// Backed by IndexedDB rather than localStorage: a saved design can include
// an uploaded logo, and a single photo easily exceeds localStorage's ~5-10MB
// per-origin quota once base64-encoded. IndexedDB has a much larger
// (browser-dependent, but typically hundreds of MB or more) quota and can
// store the logo's File object directly via the structured clone algorithm
// — no base64 round-trip needed. Every call is wrapped so a browser with
// IndexedDB unavailable or refusing to open it (private browsing in some
// older browsers, quota already exhausted) degrades to a no-op instead of
// throwing — per BUG-01, the editor must keep working either way.

export type SavedElemPos = { x: number; y: number };

export type SavedTextStyle = {
  color: string;
  letterSpacing: number;
  lineSpacing: number;
  curve: number;
  align: "left" | "center" | "right";
};

// Mirrors the editor's own Design shape (src/components/customizer/types.ts).
// Kept as a separately defined (structurally identical) type rather than
// importing it from there, so this module has no dependency on the
// component tree it's used by — the editor depends on this module, not the
// other way around.
export type SavedZoneDesign = {
  names: string;
  namesStyle: SavedTextStyle;
  textFont: string;
  date: string;
  dateStyle: SavedTextStyle;
  monogram: string;
  monogramColor: string;
  frame: string;
  frameColor: string;
  logoFile: File | null;
  logoPreview: string | null;
  logoOriginalPreview: string | null;
  logoRemoveWhiteMode: "never" | "background" | "all";
  inkColor: string;
  colorTextInput: string;
  qrUrl: string;
  qrColor: string;
  positions: Record<string, SavedElemPos>;
  elemScale: Record<string, number>;
  elemRotationOffset: Record<string, number>;
  elemOrder: string[];
  locked: Record<string, boolean | undefined>;
  hidden: Record<string, boolean | undefined>;
};

export type SavedDesign = {
  productId: string;
  versionId: string;
  updatedAt: number;
  activeZoneId: string;
  selectedExtraZoneIds: string[];
  techniqueId: string;
  variantId: string;
  quantity: number;
  zones: Record<string, SavedZoneDesign>;
};

// Lightweight metadata for a "pick a saved design" list (FLOW-02) — doesn't
// require loading every version's full payload (logo included) just to show
// a row.
export type SavedDesignSummary = {
  productId: string;
  versionId: string;
  updatedAt: number;
  techniqueId: string;
  quantity: number;
  names: string;
};

export interface DesignStorageBackend {
  save(design: SavedDesign): Promise<void>;
  load(productId: string, versionId: string): Promise<SavedDesign | null>;
  list(productId: string): Promise<SavedDesignSummary[]>;
  remove(productId: string, versionId: string): Promise<void>;
}

// The single version this document's autosave uses. Multiple versions per
// product (FLOW-02's "Pick up where you left off?" with more than one saved
// design) are a 03-purchase-flow.md concern — this interface already
// supports them (every method takes/returns a versionId), but nothing in
// 01-bug-fixes.md's scope creates a second one yet.
export const LATEST_VERSION_ID = "latest";

function toSummary(design: SavedDesign): SavedDesignSummary {
  const primary = design.zones[design.activeZoneId] ?? Object.values(design.zones)[0];
  return {
    productId: design.productId,
    versionId: design.versionId,
    updatedAt: design.updatedAt,
    techniqueId: design.techniqueId,
    quantity: design.quantity,
    names: primary?.names ?? "",
  };
}

const DB_NAME = "bespoke-designs";
const DB_VERSION = 1;
const STORE_NAME = "versions";
// The object store's keyPath — one row per (product, version).
function keyFor(productId: string, versionId: string) {
  return `${productId}::${versionId}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("productId", "productId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

type StoredRow = SavedDesign & { key: string };

class IndexedDbDesignStorage implements DesignStorageBackend {
  async save(design: SavedDesign): Promise<void> {
    const db = await openDb();
    const row: StoredRow = { ...design, key: keyFor(design.productId, design.versionId) };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async load(productId: string, versionId: string): Promise<SavedDesign | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(keyFor(productId, versionId));
      req.onsuccess = () => {
        const row = req.result as StoredRow | undefined;
        if (!row) {
          resolve(null);
          return;
        }
        const { key: _key, ...design } = row;
        void _key;
        resolve(design);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async list(productId: string): Promise<SavedDesignSummary[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("productId");
      const req = index.getAll(productId);
      req.onsuccess = () => {
        const rows = (req.result as StoredRow[]) ?? [];
        resolve(rows.map(toSummary).sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async remove(productId: string, versionId: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(keyFor(productId, versionId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

// Wraps a backend so every method fails soft — BUG-01: "If storage is
// unavailable or full, the editor keeps working and the user is not
// blocked." A save that can't be persisted is silently dropped (the design
// still lives in on-page state either way); a load/list that fails behaves
// exactly like "no saved design found" rather than surfacing an error.
class SafeDesignStorage implements DesignStorageBackend {
  constructor(private backend: DesignStorageBackend) {}

  async save(design: SavedDesign): Promise<void> {
    try {
      await this.backend.save(design);
    } catch {
      // Best-effort — see class comment.
    }
  }

  async load(productId: string, versionId: string): Promise<SavedDesign | null> {
    try {
      return await this.backend.load(productId, versionId);
    } catch {
      return null;
    }
  }

  async list(productId: string): Promise<SavedDesignSummary[]> {
    try {
      return await this.backend.list(productId);
    } catch {
      return [];
    }
  }

  async remove(productId: string, versionId: string): Promise<void> {
    try {
      await this.backend.remove(productId, versionId);
    } catch {
      // Best-effort — see class comment.
    }
  }
}

export const designStorage: DesignStorageBackend = new SafeDesignStorage(new IndexedDbDesignStorage());

// Exported for tests, and for a future server-backed implementation to
// compose the same fail-soft wrapper around itself.
export { SafeDesignStorage, IndexedDbDesignStorage };

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  key: string; // unique per configuration (productId + personalization)
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  minOrder: number;
  leadTimeMin?: number;
  leadTimeMax?: number;
  variantId?: string;
  variantLabel?: string;
  // A one-off sample of the current configuration, bought to check quality/
  // fit before committing to the full run — bypasses the product's normal
  // minOrder (always quantity 1) and carries a flat machine-setup fee
  // rather than a per-unit one, so it's tracked separately from
  // personalization's own per-unit extraPrice.
  isSample?: boolean;
  sampleFee?: number;
  personalization?: {
    names?: string;
    date?: string;
    monogram?: string;
    frame?: string;
    textFont?: string;
    technique?: string;
    extraPrice?: number;
    elemScale?: Record<string, number>;
    elemRotationOffset?: Record<string, number>;
    positions?: Record<string, { x: number; y: number }>;
    hasLogo?: boolean;
    renderUrl?: string;
    renderContextUrl?: string;
    snapshotUrl?: string;
    // Only set for a single-color-ink print technique: the exact ink color
    // the customer picked for their logo, plus the closest approximate
    // PANTONE Solid Coated match (not an official Pantone conversion — no
    // licensed Pantone data is integrated in this app).
    inkColorHex?: string;
    inkPantoneCode?: string;
    // The logo traced into vector path data at upload time (see
    // src/lib/logoVectorize.ts) — only present for single-color-ink
    // techniques, so the print-ready outline file can include the logo as
    // true curves instead of an embedded raster.
    logoVector?: { ds: string[]; width: number; height: number } | null;
  };
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  subtotal: number;
  personalizationFee: number;
  sampleFee: number;
  totalPieces: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(plannerSlug: string) {
  return `bespoke-cart:${plannerSlug}`;
}

export function CartProvider({
  plannerSlug,
  children,
}: {
  plannerSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrates cart state from a prior visit's localStorage snapshot.
    const raw = localStorage.getItem(storageKey(plannerSlug));
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(JSON.parse(raw));
      } catch {
        // ignore corrupt cart
      }
    }
    setHydrated(true);
  }, [plannerSlug]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(plannerSlug), JSON.stringify(items));
  }, [items, plannerSlug, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key);
      if (existing) {
        return prev.map((i) =>
          i.key === item.key ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (key: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(i.minOrder, quantity) } : i))
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const clear = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  );
  const personalizationFee = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (i.personalization?.extraPrice ?? 0) * i.quantity,
        0
      ),
    [items]
  );
  const sampleFee = useMemo(
    () => items.reduce((sum, i) => sum + (i.isSample ? (i.sampleFee ?? 0) : 0), 0),
    [items]
  );
  const totalPieces = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clear,
        subtotal,
        personalizationFee,
        sampleFee,
        totalPieces,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

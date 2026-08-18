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
  const totalPieces = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clear, subtotal, personalizationFee, totalPieces }}
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

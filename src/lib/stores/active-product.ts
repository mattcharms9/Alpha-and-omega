import { create } from "zustand";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

interface ActiveProductStore {
  activeProduct: ProductBlueprint | null;
  activeProductId: string | null;
  setActiveProduct: (product: ProductBlueprint, id?: string) => void;
  clearActiveProduct: () => void;
}

export const useActiveProduct = create<ActiveProductStore>((set) => ({
  activeProduct: null,
  activeProductId: null,
  setActiveProduct: (product, id) => set({ activeProduct: product, activeProductId: id ?? null }),
  clearActiveProduct: () => set({ activeProduct: null, activeProductId: null }),
}));

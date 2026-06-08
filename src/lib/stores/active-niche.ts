import { create } from "zustand";
import type { SubNiche } from "@/lib/ai/niche-types";

interface ActiveNicheStore {
  activeNiche: SubNiche | null;
  activeSavedId: string | null;
  setActiveNiche: (niche: SubNiche, savedId?: string) => void;
  clearActiveNiche: () => void;
}

export const useActiveNiche = create<ActiveNicheStore>((set) => ({
  activeNiche: null,
  activeSavedId: null,
  setActiveNiche: (niche, savedId) =>
    set({ activeNiche: niche, activeSavedId: savedId ?? null }),
  clearActiveNiche: () => set({ activeNiche: null, activeSavedId: null }),
}));

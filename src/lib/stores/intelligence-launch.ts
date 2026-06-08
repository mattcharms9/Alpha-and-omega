import { create } from "zustand";

export interface IntelligenceLaunchContext {
  emotion: string;
  nicheName: string;
  audienceArchetypes: string[];
  opportunityScore: number;
  productOpportunities: string[];
}

interface IntelligenceLaunchStore {
  launchContext: IntelligenceLaunchContext | null;
  setLaunchContext: (ctx: IntelligenceLaunchContext) => void;
  clearLaunchContext: () => void;
}

export const useIntelligenceLaunch = create<IntelligenceLaunchStore>((set) => ({
  launchContext: null,
  setLaunchContext: (ctx) => set({ launchContext: ctx }),
  clearLaunchContext: () => set({ launchContext: null }),
}));

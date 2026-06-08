"use client";

import { createContext, useContext } from "react";

interface SidebarContextValue {
  closeMobile: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
  closeMobile: () => {},
});

export function useSidebarContext(): SidebarContextValue {
  return useContext(SidebarContext);
}

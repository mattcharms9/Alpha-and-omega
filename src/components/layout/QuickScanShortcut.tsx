"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function QuickScanShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const trigger =
        (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === "S";
      if (!trigger) return;
      e.preventDefault();

      if (pathname === "/intelligence") {
        // Fire a CustomEvent the intelligence page can listen to
        window.dispatchEvent(new CustomEvent("ao:quickScan"));
      } else {
        setScanning(true);
        router.push("/intelligence?autoScan=true");
        setTimeout(() => setScanning(false), 3000);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  if (!scanning) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 100,
        background: "var(--text-primary)",
        color: "white",
        borderRadius: "var(--radius-lg)",
        padding: "0.625rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
      Running intelligence scan…
    </div>
  );
}

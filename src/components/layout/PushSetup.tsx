"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}


export default function PushSetup() {
  useEffect(() => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function setup() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) return; // already subscribed

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        });

        const { endpoint, keys } = subscription.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };

        await fetch("/api/push?action=subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "",
          },
          body: JSON.stringify({
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userAgent: navigator.userAgent,
          }),
        });
      } catch (err) {
        console.error("[PushSetup] Failed:", err);
      }
    }

    void setup();
  }, []);

  return null;
}

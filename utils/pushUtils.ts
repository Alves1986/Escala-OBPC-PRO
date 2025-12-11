
// Safe Access VAPID Key from Environment Variables
let vapidKey = "";

try {
  // @ts-ignore
  const meta = import.meta;
  if (meta && meta.env) {
    vapidKey = meta.env.VITE_VAPID_PUBLIC_KEY;
  }
} catch (e) {}

export const VAPID_PUBLIC_KEY = vapidKey || "";

if (!VAPID_PUBLIC_KEY) {
  console.warn("⚠️ VITE_VAPID_PUBLIC_KEY is missing. Push notifications will not work.");
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

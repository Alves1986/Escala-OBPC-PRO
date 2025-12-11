
// Access VAPID Key from Environment Variables
// Ensure VITE_VAPID_PUBLIC_KEY is set in your .env or Vercel Settings
const env = (import.meta as any).env || {};

export const VAPID_PUBLIC_KEY = env.VITE_VAPID_PUBLIC_KEY || "";

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


// This is a DEMO public key. In production, run: npx web-push generate-vapid-keys
// and replace this with your generated PUBLIC key.
export const VAPID_PUBLIC_KEY = "BKiwTvD9E5y-O8t7slXpC-90e8jXqYd1E5c5oG6bZ3l1vR8gH9kL7mN0pQ2rS4tU6vW8xY0zA1b2c3d4e5f6g";

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

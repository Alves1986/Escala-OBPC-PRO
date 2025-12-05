
// Chave Pública gerada pelo usuário para Push Notifications
export const VAPID_PUBLIC_KEY = "BF16yQvZzPhqIFKl0CVYgNtjonnfgGI39QPOHXcmu0_kGL9V9llvULEMaQajIxT8nEW8rRQ_kWacpDc1zQi9EYs";

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

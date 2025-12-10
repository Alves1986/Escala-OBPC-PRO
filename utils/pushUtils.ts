

// Chave Pública gerada pelo usuário para Push Notifications
export const VAPID_PUBLIC_KEY = "BDug4Y7xlqoJF0ihCLqHDsJtzYqZhLnKlWr0y-ynKLscqQH8nWqJo6LpLy65tx1VWwD5FRD8gfI4NxisdJ7dWUc";

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
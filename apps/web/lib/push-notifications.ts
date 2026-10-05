import { api } from './api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  endpoint?: string;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'unsupported', isSubscribed: false };
  }

  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) {
    return { supported: false, permission: 'unsupported', isSubscribed: false };
  }

  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) {
      return { supported: true, permission, isSubscribed: false };
    }
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      isSubscribed: !!sub,
      endpoint: sub?.endpoint
    };
  } catch {
    return { supported: true, permission, isSubscribed: false };
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[Agency OS] Service Worker registration notice:', err);
    return null;
  }
}

export async function subscribeToPush(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'Window not available' };

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      success: false,
      message: 'Push notifications are not supported on this browser. On iPhone, make sure to tap Share → "Add to Home Screen" first!'
    };
  }

  // Request notification permission from user
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      success: false,
      message: permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications in your device browser settings.'
        : 'Notification permission was dismissed.'
    };
  }

  // Ensure Service Worker is active
  let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) {
    reg = await registerServiceWorker();
  }
  if (!reg) {
    return { success: false, message: 'Failed to initialize Service Worker.' };
  }

  // Wait for service worker to be ready
  const activeReg = await navigator.serviceWorker.ready;

  // Retrieve VAPID public key from backend
  const { publicKey } = await api<{ publicKey: string }>('/notifications/vapid-public-key');
  if (!publicKey) {
    return { success: false, message: 'VAPID public key not found on server.' };
  }

  // Subscribe with device PushManager
  let subscription = await activeReg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  // Send subscription to backend
  const rawSub = subscription.toJSON();
  if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
    return { success: false, message: 'Could not extract device encryption keys.' };
  }

  await api('/notifications/subscribe-push', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: rawSub.endpoint,
      keys: {
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth
      },
      userAgent: navigator.userAgent
    })
  });

  return { success: true, message: 'Push notifications enabled successfully!' };
}

export async function unsubscribeFromPush(): Promise<{ success: boolean }> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return { success: true };
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('/notifications/unsubscribe-push', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint })
        }).catch(() => {});
        await sub.unsubscribe();
      }
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function sendTestNotification(): Promise<void> {
  await api('/notifications/test-push', { method: 'POST' });
}

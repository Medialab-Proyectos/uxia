// PWA + notificaciones. Registro del service worker, permiso de notificaciones, suscripción a
// push (si hay VAPID configurado) y notificaciones locales (mientras la app está abierta/instalada).
//
// El push "con la app cerrada" necesita:
//   - VITE_VAPID_PUBLIC_KEY en el navegador (clave pública, es pública).
//   - VAPID_PRIVATE_KEY + VAPID_SUBJECT en el servidor (NUNCA en el navegador).
//   - la tabla push_subscriptions (migration-push.sql) y el cron api/notify-cron.
// Sin eso, igual funcionan la instalación y las notificaciones locales.

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

let swReg = null;

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
    return swReg;
  } catch {
    return null;
  }
}

export function notificationState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Suscribe este dispositivo al push del servidor y registra la suscripción en la base (por usuario).
// Requiere permiso concedido + VAPID configurado. Devuelve true si quedó suscrito.
export async function subscribeToPush({ token, companyId = "" } = {}) {
  if (!pushSupported() || !VAPID_PUBLIC) return false;
  if (notificationState() !== "granted") return false;
  const reg = swReg || (await navigator.serviceWorker.ready);
  if (!reg) return false;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ subscription: sub, companyId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Notificación local (app abierta/instalada). Útil de inmediato aunque no haya push del servidor.
export async function notifyLocal(title, body, url = "/") {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = swReg || (await navigator.serviceWorker.ready);
    if (reg) {
      await reg.showNotification(title, { body, icon: "/web-app-manifest-192x192.png", badge: "/web-app-manifest-192x192.png", data: { url }, tag: "uxia-local", renotify: true });
    } else {
      new Notification(title, { body, icon: "/web-app-manifest-192x192.png" });
    }
  } catch { /* no-op */ }
}

// Dispara una notificación push instantánea por un evento (fire-and-forget; nunca rompe la UI).
// El servidor (api/notify-event) decide el destinatario según el tipo y la tarea.
export function notifyEvent(token, payload) {
  try {
    fetch("/api/notify-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch { /* no-op */ }
}

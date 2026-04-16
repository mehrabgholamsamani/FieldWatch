/**
 * Tiny event bus used by the Axios interceptor (a non-React module) to signal
 * that a forced logout has occurred (e.g. refresh token expired).
 *
 * Avoids a circular import: authStore → api → authStore.
 * _layout.tsx registers the handler once on mount; api.ts calls triggerForceLogout().
 */
type Handler = () => void;
let _handler: Handler | null = null;

export function setForceLogoutHandler(fn: Handler): void {
  _handler = fn;
}

export function triggerForceLogout(): void {
  _handler?.();
}

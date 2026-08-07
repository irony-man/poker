/**
 * Mobile play immersive helpers.
 * Fullscreen API needs a user gesture; call {@link enterMobileFullscreen} from
 * click/tap handlers when navigating into a table, and again from play-route
 * interaction fallbacks.
 */

const MOBILE_MEDIA =
  '(max-width: 639px), (max-height: 560px) and (max-width: 1100px), (pointer: coarse) and (max-width: 1024px)';

export function isMobilePlayViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MEDIA).matches;
}

function fullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function requestFs(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    webkitRequestFullScreen?: () => void;
  };
  if (typeof el.requestFullscreen === 'function') {
    return el.requestFullscreen({ navigationUI: 'hide' }).then(() => undefined);
  }
  if (typeof anyEl.webkitRequestFullscreen === 'function') {
    anyEl.webkitRequestFullscreen();
    return Promise.resolve();
  }
  if (typeof anyEl.webkitRequestFullScreen === 'function') {
    anyEl.webkitRequestFullScreen();
    return Promise.resolve();
  }
  return Promise.reject(new Error('Fullscreen unsupported'));
}

function exitFs(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
    webkitCancelFullScreen?: () => void;
  };
  if (fullscreenElement() == null) return Promise.resolve();
  if (typeof document.exitFullscreen === 'function') {
    return document.exitFullscreen().then(() => undefined);
  }
  if (typeof doc.webkitExitFullscreen === 'function') {
    doc.webkitExitFullscreen();
    return Promise.resolve();
  }
  if (typeof doc.webkitCancelFullScreen === 'function') {
    doc.webkitCancelFullScreen();
    return Promise.resolve();
  }
  return Promise.resolve();
}

/** Fire from a user-gesture handler before async work when entering play. */
export function enterMobileFullscreen(): void {
  if (typeof window === 'undefined' || !isMobilePlayViewport()) return;
  if (fullscreenElement()) return;
  const root = document.documentElement;
  void requestFs(root).catch(() => {
    /* iOS / policy — fall through; play shell still uses full dvh */
  });
}

/** Leave fullscreen when navigating out of play routes. */
export function exitMobileFullscreen(): void {
  if (typeof window === 'undefined') return;
  void exitFs().catch(() => {
    /* ignore */
  });
}

/**
 * On play routes: grab fullscreen on the next user gesture if not already full,
 * and exit when the effect cleans up (route leave).
 */
export function attachPlayFullscreen(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  if (!isMobilePlayViewport()) {
    return () => undefined;
  }

  // Try immediately (works only with an active user activation from navigation).
  enterMobileFullscreen();

  const onGesture = () => {
    enterMobileFullscreen();
  };

  // Capture first interactions so join/sit/buttons complete the fullscreen
  // request after router.push dropped the original activation.
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });

  const onChange = () => {
    /* no-op: CSS can key off :fullscreen if needed later */
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange as EventListener);

  return () => {
    window.removeEventListener('pointerdown', onGesture, { capture: true });
    window.removeEventListener('touchstart', onGesture, { capture: true });
    window.removeEventListener('keydown', onGesture, { capture: true });
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange as EventListener);
    exitMobileFullscreen();
  };
}

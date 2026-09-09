import { useEffect } from 'react';

let lockCount = 0;
let originalMainOverflow = '';

/**
 * Locks the background scroll of the main content area when a modal or dialog is open.
 * Safely targets #main-content-scroll without locking document.body or html,
 * which preserves native touch scrolling compositor threads on iOS/iPadOS and Android tablets.
 */
export function lockBackgroundScroll() {
  if (typeof document === 'undefined') return;

  lockCount++;
  if (lockCount === 1) {
    const mainContent = document.getElementById('main-content-scroll');
    if (mainContent) {
      originalMainOverflow = mainContent.style.overflow || '';
      mainContent.style.overflow = 'hidden';
    }
  }
}

/**
 * Unlocks background scroll when all popups/modals are closed.
 */
export function unlockBackgroundScroll() {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const mainContent = document.getElementById('main-content-scroll');
    if (mainContent) {
      mainContent.style.overflow = originalMainOverflow;
    }
  }
}

/**
 * React hook to lock background scroll while `isOpen` is true.
 * Automatically cleans up on unmount or when `isOpen` becomes false.
 */
export function useScrollLock(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;

    lockBackgroundScroll();

    return () => {
      unlockBackgroundScroll();
    };
  }, [isOpen]);
}

/**
 * Global listener safely no-op'd so it never registers blocking non-passive
 * touchmove listeners on document/window that freeze tablet gestures.
 */
export function initGlobalModalScrollListener(): () => void {
  return () => {};
}

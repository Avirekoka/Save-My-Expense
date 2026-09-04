import { useEffect } from 'react';

let lockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalMainOverflow = '';
let originalBodyPaddingRight = '';
let originalHeaderPaddingRight = '';

/**
 * Locks the background scroll when a modal or popup is open.
 * Handles document.body, document.documentElement, and the app's #main-content-scroll container.
 * Also prevents layout shift by compensating for scrollbar width.
 */
export function lockBackgroundScroll() {
  if (typeof document === 'undefined') return;

  lockCount++;
  if (lockCount === 1) {
    const body = document.body;
    const html = document.documentElement;
    const mainContent = document.getElementById('main-content-scroll');
    const header = document.querySelector('header');

    // Save previous styles
    originalBodyOverflow = body.style.overflow || '';
    originalHtmlOverflow = html.style.overflow || '';
    originalBodyPaddingRight = body.style.paddingRight || '';
    if (header) {
      originalHeaderPaddingRight = (header as HTMLElement).style.paddingRight || '';
    }
    if (mainContent) {
      originalMainOverflow = mainContent.style.overflow || '';
    }

    // Calculate scrollbar width
    const scrollBarWidth = window.innerWidth - html.clientWidth;
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
      if (header) {
        (header as HTMLElement).style.paddingRight = `${scrollBarWidth}px`;
      }
    }

    // Apply scroll lock
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    body.classList.add('overflow-hidden');
    html.classList.add('overflow-hidden');

    if (mainContent) {
      mainContent.style.overflow = 'hidden';
      mainContent.classList.add('overflow-hidden');
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
    const body = document.body;
    const html = document.documentElement;
    const mainContent = document.getElementById('main-content-scroll');
    const header = document.querySelector('header');

    body.style.overflow = originalBodyOverflow;
    html.style.overflow = originalHtmlOverflow;
    body.style.paddingRight = originalBodyPaddingRight;
    body.classList.remove('overflow-hidden');
    html.classList.remove('overflow-hidden');

    if (header) {
      (header as HTMLElement).style.paddingRight = originalHeaderPaddingRight;
    }

    if (mainContent) {
      mainContent.style.overflow = originalMainOverflow;
      mainContent.classList.remove('overflow-hidden');
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
 * Global listener that attaches once at the app root to safeguard against any modal/dialog
 * backdrop touch or wheel scrolling into the background.
 */
export function initGlobalModalScrollListener(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Prevent touchmove on backdrop elements that don't need to scroll
  const handleTouchMove = (e: TouchEvent) => {
    if (lockCount <= 0) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // If the touch target is the backdrop itself (e.g. fixed inset-0 overlay), prevent scroll
    if (
      target.classList.contains('fixed') &&
      target.classList.contains('inset-0')
    ) {
      e.preventDefault();
    }
  };

  // Prevent mouse wheel on backdrop elements
  const handleWheel = (e: WheelEvent) => {
    if (lockCount <= 0) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (
      target.classList.contains('fixed') &&
      target.classList.contains('inset-0')
    ) {
      e.preventDefault();
    }
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('wheel', handleWheel);
  };
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Returns visible, focusable descendants for keyboard trapping inside a dialog.
 */
export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.tabIndex !== -1 &&
      element.offsetParent !== null,
  );
}

/**
 * Traps Tab / Shift+Tab within a container (e.g. cookie consent dialog).
 */
export function trapTabKey(container: HTMLElement, event: KeyboardEvent) {
  if (event.key !== 'Tab') {
    return;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

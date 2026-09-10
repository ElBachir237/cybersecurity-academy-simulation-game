"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlayLock } from "./context";

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
}

function topDialog() {
  const dialogs = document.querySelectorAll<HTMLElement>('[data-horizon-dialog]');
  return dialogs[dialogs.length - 1];
}

export function Modal({
  open,
  onClose,
  children,
  width = 560,
  dismissable = true,
  label = "Horizon",
  variant = "default",
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  dismissable?: boolean;
  label?: string;
  variant?: "default" | "call" | "sheet";
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef({ onClose, dismissable });
  closeRef.current = { onClose, dismissable };
  useEffect(() => setMounted(true), []);
  useOverlayLock(open && mounted);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => {
      const target = dialog.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? focusable(dialog)[0] ?? dialog;
      target.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusFirst);
    const onKey = (event: KeyboardEvent) => {
      if (topDialog() !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (closeRef.current.dismissable) closeRef.current.onClose?.();
      }
      if (event.key === "Tab") {
        const targets = focusable(dialog);
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const guardFocus = (event: FocusEvent) => {
      if (topDialog() === dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", guardFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", guardFocus);
      requestAnimationFrame(() => {
        const remaining = topDialog();
        if (previous?.isConnected && !previous.closest('[inert], [hidden]') && (!remaining || remaining.contains(previous))) {
          previous.focus({ preventScroll: true });
        } else if (remaining) {
          (focusable(remaining)[0] ?? remaining).focus({ preventScroll: true });
        }
      });
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className={`hz-dialog-backdrop hz-dialog-backdrop--${variant}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && dismissable) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`hz-dialog hz-dialog--${variant}`}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-horizon-dialog=""
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

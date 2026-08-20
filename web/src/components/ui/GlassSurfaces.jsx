import { forwardRef } from "react";
import clsx from "clsx";

export const GlassPanel = forwardRef(function GlassPanel(
  { as: Component = "section", className, ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={clsx("glass-panel", className)}
      {...props}
    />
  );
});

export const GlassCard = forwardRef(function GlassCard(
  { className, ...props },
  ref,
) {
  return (
    <GlassPanel ref={ref} className={clsx("card", className)} {...props} />
  );
});

export const GlassDialogContent = forwardRef(function GlassDialogContent(
  { className, ...props },
  ref,
) {
  return (
    <GlassPanel
      ref={ref}
      as="div"
      role="dialog"
      aria-modal="true"
      className={clsx("modal glass-dialog", className)}
      {...props}
    />
  );
});

export const GlassPopoverContent = forwardRef(function GlassPopoverContent(
  { className, ...props },
  ref,
) {
  return (
    <GlassPanel
      ref={ref}
      as="div"
      className={clsx("glass-popover", className)}
      {...props}
    />
  );
});

export const GlassDropdownContent = forwardRef(function GlassDropdownContent(
  { className, ...props },
  ref,
) {
  return (
    <GlassPanel
      ref={ref}
      as="div"
      role="menu"
      className={clsx("glass-dropdown", className)}
      {...props}
    />
  );
});

export const GlassSheetContent = forwardRef(function GlassSheetContent(
  { className, ...props },
  ref,
) {
  return (
    <GlassPanel
      ref={ref}
      as="aside"
      className={clsx("glass-sheet", className)}
      {...props}
    />
  );
});

export const GlassButton = forwardRef(function GlassButton(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx("btn btn-glass", className)}
      {...props}
    />
  );
});

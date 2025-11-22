"use client";
import { RefObject, useEffect } from "react";

export type RemoteNavOptions = {
  /** CSS selector for focusable children inside the container */
  selector?: string;
  /** Add this class to focused element (optional) */
  focusClass?: string;
  /** If true, left/right wraps around */
  loop?: boolean;
  /** If true, scroll the container so the focused element is visible/centered */
  autoScroll?: boolean;
};

/**
 * Global registry of containers managed by the hook.
 * We store the actual HTMLElement nodes so key handling can find containers visually.
 */
const containers = new Set<HTMLElement>();

/** single global key listener that drives navigation among registered containers */
let listenerAttached = false;

function visible(el: HTMLElement) {
  // cheap visibility check
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getFocusables(container: HTMLElement, selector: string) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
  // filter out hidden elements
  return nodes.filter((n) => visible(n) && !n.hasAttribute("disabled"));
}

function centerElementInContainer(el: HTMLElement, container: HTMLElement) {
  // Prefer smooth centering for horizontal scrollable rows.
  // If the container scrolls horizontally, center horizontally; otherwise use scrollIntoView.
  const style = window.getComputedStyle(container);
  const isHorizontal = container.scrollWidth > container.clientWidth && style.overflowX !== "hidden";

  if (isHorizontal) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const elMid = elRect.left - containerRect.left + elRect.width / 2;
    const targetScroll = Math.max(0, elMid - container.clientWidth / 2);
    container.scrollTo({ left: targetScroll + container.scrollLeft - container.scrollLeft, behavior: "smooth" });
    // fallback scrollIntoView as well to be safe
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

/** find container that contains element (among registered containers) */
function findContainerForElement(active: Element | null) {
  if (!active) return null;
  for (const c of containers) {
    if (c.contains(active)) return c;
  }
  return null;
}

/** compute containers sorted by vertical position (top) */
function getOrderedContainers() {
  const arr = Array.from(containers);
  arr.sort((a, b) => {
    const ta = a.getBoundingClientRect().top;
    const tb = b.getBoundingClientRect().top;
    return ta - tb;
  });
  return arr;
}

/** returns the closest container above or below current */
function getAdjacentContainer(current: HTMLElement, direction: "up" | "down") {
  const ordered = getOrderedContainers();
  const idx = ordered.findIndex((c) => c === current);
  if (idx === -1) return null;
  if (direction === "down") {
    return ordered.slice(idx + 1).find(Boolean) ?? null;
  } else {
    return ordered.slice(0, idx).reverse().find(Boolean) ?? null;
  }
}

function ensureGlobalListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  window.addEventListener("keydown", (e) => {
    const active = document.activeElement as HTMLElement | null;
    // only handle arrow keys
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;

    // find container that currently holds the focused element
    const activeContainer = findContainerForElement(active);

    // if active is inside a registered container, let that container handle left/right/up/down behavior
    if (activeContainer) {
      // find focusables inside this container (we don't know which selector each container used, so probe common set)
      const selector = activeContainer.getAttribute("data-remote-selector") || 'a,button,[tabindex="0"],[data-focusable],input,select,textarea';
      const focusables = getFocusables(activeContainer, selector);
      const currentIndex = Math.max(0, focusables.indexOf(active || focusables[0]));

      // left / right -> move within container
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const loop = activeContainer.getAttribute("data-remote-loop") === "true";
        const nextIndex = currentIndex <= 0 ? (loop ? focusables.length - 1 : 0) : currentIndex - 1;
        const el = focusables[nextIndex];
        el?.focus();
        if (activeContainer.getAttribute("data-remote-autoscroll") === "true" && el) centerElementInContainer(el, activeContainer);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const loop = activeContainer.getAttribute("data-remote-loop") === "true";
        const nextIndex = currentIndex >= focusables.length - 1 ? (loop ? 0 : focusables.length - 1) : currentIndex + 1;
        const el = focusables[nextIndex];
        el?.focus();
        if (activeContainer.getAttribute("data-remote-autoscroll") === "true" && el) centerElementInContainer(el, activeContainer);
        return;
      }

      // down -> move to the nearest container below and focus its first focusable
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const below = getAdjacentContainer(activeContainer, "down");
        if (below) {
          const sel = below.getAttribute("data-remote-selector") || 'a,button,[tabindex="0"],[data-focusable],input,select,textarea';
          const belowFocus = getFocusables(below, sel)[0] ?? null;
          if (belowFocus) {
            belowFocus.focus();
            if (below.getAttribute("data-remote-autoscroll") === "true") centerElementInContainer(belowFocus, below);
          }
        }
        return;
      }

      // up -> move to the nearest container above
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const above = getAdjacentContainer(activeContainer, "up");
        if (above) {
          const sel = above.getAttribute("data-remote-selector") || 'a,button,[tabindex="0"],[data-focusable],input,select,textarea';
          const aboveFocus = getFocusables(above, sel)[0] ?? null;
          if (aboveFocus) {
            aboveFocus.focus();
            if (above.getAttribute("data-remote-autoscroll") === "true") centerElementInContainer(aboveFocus, above);
          }
        }
        return;
      }

      // Enter should be default (activates element), so do nothing special.
      return;
    } else {
      // Focus is outside registered containers. If ArrowDown pressed and there are any registered containers,
      // focus the topmost container's first focusable.
      if (e.key === "ArrowDown" && containers.size > 0) {
        e.preventDefault();
        const ordered = getOrderedContainers();
        const first = ordered[0];
        if (first) {
          const sel = first.getAttribute("data-remote-selector") || 'a,button,[tabindex="0"],[data-focusable],input,select,textarea';
          const firstFocusable = getFocusables(first, sel)[0] ?? null;
          firstFocusable?.focus();
          if (first.getAttribute("data-remote-autoscroll") === "true" && firstFocusable) centerElementInContainer(firstFocusable, first);
        }
      }
    }
  });
}

export function useRemoteNav(containerRef: RefObject<HTMLElement | null>, options?: RemoteNavOptions) {
  useEffect(() => {
    const el = containerRef?.current ?? null;
    if (!el) return;

    // defaults
    const selector = options?.selector ?? 'a,button,[tabindex="0"],[data-focusable],input,select,textarea';
    const focusClass = options?.focusClass ?? "";
    const loop = options?.loop ?? false;
    const autoScroll = options?.autoScroll ?? false;

    // add attributes to container so the global listener can find its preferences
    el.setAttribute("data-remote-selector", selector);
    el.setAttribute("data-remote-loop", String(loop));
    el.setAttribute("data-remote-autoscroll", String(autoScroll));

    // add to registry
    containers.add(el);

    // ensure global listener exists
    ensureGlobalListener();

    // make focusable children tabbable and optionally add tv class
    const focusables = getFocusables(el, selector);
    focusables.forEach((f, i) => {
      // only add tabindex if it doesn't exist already
      if (!f.hasAttribute("tabindex")) f.setAttribute("tabindex", "0");
      // set index attribute (optional, helpful for debugging)
      f.setAttribute("data-remote-index", String(i));
      if (options?.focusClass) f.classList.add(options.focusClass);
    });

    // on focus -> optionally autoscroll the element within the container
    const onFocus = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && autoScroll) {
        centerElementInContainer(target, el);
      }
    };
    el.addEventListener("focusin", onFocus);

    return () => {
      // cleanup
      el.removeAttribute("data-remote-selector");
      el.removeAttribute("data-remote-loop");
      el.removeAttribute("data-remote-autoscroll");

      const focusablesNow = getFocusables(el, selector);
      focusablesNow.forEach((f) => {
        // do not remove tabindex if it was user-defined (we only added ones that didn't exist)
        // but for simplicity we'll leave tabindex as is. remove class/index
        f.removeAttribute("data-remote-index");
        if (options?.focusClass) f.classList.remove(options.focusClass);
      });

      el.removeEventListener("focusin", onFocus);
      containers.delete(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef?.current, JSON.stringify(options ?? {})]);
}

/**
 * cursor-content.js
 *
 * Shows a message or icon inside the cursor when hovering `.cursor-content`
 * elements, with optional tilt support.
 */

import { cursor, createTiltController } from "./cursor-base.js";

if (cursor) {
  const triggers = document.querySelectorAll(".cursor-content");
  const messageEl = cursor.querySelector(".mouse-cursor__message");
  const iconEl = cursor.querySelector(".mouse-cursor__icon");

  const defaultIconPath = iconEl.style.maskImage
    .replace(/url\(['"]?(.*?)['"]?\)/, "$1")
    .trim();
  const defaultIconColor = "var(--color-font--primary)";
  const defaultIconSize = "sm";

  let hideTimeout = null;

  const applySize = (size) => {
    iconEl.classList.remove(
      "mouse-cursor__icon-sm",
      "mouse-cursor__icon-md",
      "mouse-cursor__icon-lg",
    );
    iconEl.classList.add(`mouse-cursor__icon-${size}`);
  };

  triggers.forEach((el) => {
    const messageText = el.dataset.cursorMessage || "";
    const iconPath = el.dataset.cursorIcon || "";
    const iconPathSwap = el.dataset.cursorIconSwap || "";
    const iconColor = el.dataset.cursorIconColor || defaultIconColor;
    const iconSize = el.dataset.cursorIconSize || defaultIconSize;
    const customClass = el.dataset.cursorClass || "";

    const hasMessage = Boolean(messageText);
    const hasIcon = iconPath !== "" || el.hasAttribute("data-cursor-icon");
    let isSwapped = false;

    // ─── Tilt Controller ──────────────────────────────────────────────────
    // Initialize tilt if the attribute exists on the trigger element
    const tilt = el.hasAttribute("data-cursor-tilt")
      ? createTiltController(cursor, {
          max: Number.parseFloat(el.dataset.tiltMax || "15"),
          velocityMax: Number.parseFloat(el.dataset.tiltVelocityMax || "1800"),
          inSpeed: Number.parseFloat(el.dataset.tiltInSpeed || "0.12"),
          outSpeed: Number.parseFloat(el.dataset.tiltOutSpeed || "0.12"),
          idleMs: Number.parseFloat(el.dataset.tiltIdleMs || "90"),
          reverse: el.hasAttribute("data-tilt-reverse"),
        })
      : null;

    const showCursor = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      if (hasMessage) {
        messageEl.textContent = messageText;
        cursor.classList.add("show-message");
      } else if (hasIcon) {
        iconEl.style.maskImage = `url('${iconPath || defaultIconPath}')`;
        iconEl.style.backgroundColor = iconColor;
        applySize(iconSize);
        cursor.classList.add("show-icon");
      }
      if (customClass) cursor.classList.add(customClass);
    };

    const hideCursor = () => {
      cursor.style.rotate = "0deg";

      messageEl.textContent = "";
      cursor.classList.remove("show-message", "show-icon");
      if (customClass) cursor.classList.remove(customClass);

      iconEl.style.backgroundColor = defaultIconColor;
      applySize(defaultIconSize);

      hideTimeout = setTimeout(() => {
        iconEl.style.maskImage = `url('${defaultIconPath}')`;
        hideTimeout = null;
      }, 200);
    };

    // ─── Event Listeners ──────────────────────────────────────────────────
    el.addEventListener("mouseenter", showCursor);
    el.addEventListener("mouseleave", hideCursor);
    el.addEventListener("click", () => {
      if (!iconPathSwap) return;
      isSwapped = !isSwapped;
      iconEl.style.maskImage = `url('${isSwapped ? iconPathSwap : iconPath || defaultIconPath}')`;
    });

    // If tilt is enabled, update it on mousemove
    if (tilt) {
      el.addEventListener("mousemove", (e) => {
        tilt.update(e.clientX, e.clientY);
      });
    }
  });
}

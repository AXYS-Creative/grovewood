export const root = document.documentElement; // See portfolio for examples

export const mqMouse = window.matchMedia(
  "(hover: hover) and (pointer: fine)",
).matches;
export const mqMotionAllow = window.matchMedia(
  "(prefers-reduced-motion: no-preference)",
).matches;
export const mqNoMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
export const mqMaxLg = window.matchMedia("(max-width: 1024px)").matches;
export const mqMinLg = window.matchMedia("(min-width: 1025px)").matches;
export const mqMaxMd = window.matchMedia("(max-width: 768px)").matches;

// Remember to add 'data-lenis-prevent' to any that should scroll normally
export const lenis = new Lenis({
  autoRaf: true,
  lerp: 0.5, // default ≈ 0.1
  duration: 1.2, // seconds
});

//
// Library DELETE ME
//

// Color converter for data- props that take a color
export const ColorUtils = (() => {
  // Cache to avoid recreating temp elements
  let tempEl = null;

  function getTempElement() {
    if (!tempEl) {
      tempEl = document.createElement("div");
      tempEl.style.display = "none";
      document.body.appendChild(tempEl);
    }
    return tempEl;
  }

  /**
   * Parse any valid CSS color value to RGB object
   * @param {string} colorString - Any valid CSS color (named, hex, rgb, hsl, var(), etc.)
   * @param {HTMLElement} element - Element for resolving CSS variables (optional)
   * @returns {{r: number, g: number, b: number}|null} RGB object or null if invalid
   */
  function parseColor(colorString, element = null) {
    if (!colorString) return null;

    // Handle CSS variables
    if (colorString.startsWith("var(")) {
      const varName = colorString.match(/var\((--[^,)]+)/)?.[1];
      if (varName && element) {
        const computedStyle = getComputedStyle(element);
        colorString = computedStyle.getPropertyValue(varName).trim();
      }
    }

    // Use browser to parse any valid CSS color
    const temp = getTempElement();
    temp.style.color = colorString;

    const computedColor = getComputedStyle(temp).color;

    // Parse the computed rgb/rgba value
    const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }

    return null;
  }

  /**
   * Convert RGB object to rgba() string
   * @param {{r: number, g: number, b: number}} color - RGB color object
   * @param {number} alpha - Alpha value (0-1)
   * @returns {string} rgba() string
   */
  function toRgbaString(color, alpha = 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  /**
   * Convert RGB object to hex string
   * @param {{r: number, g: number, b: number}} color - RGB color object
   * @returns {string} hex color string
   */
  function toHex(color) {
    const toHexByte = (n) => n.toString(16).padStart(2, "0");
    return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
  }

  /**
   * Cleanup temp element (call on page unload if needed)
   */
  function cleanup() {
    if (tempEl && tempEl.parentNode) {
      tempEl.parentNode.removeChild(tempEl);
      tempEl = null;
    }
  }

  return {
    parseColor,
    toRgbaString,
    toHex,
    cleanup,
  };
})();

// Global config shared everywhere
export const globalConfig = {
  // loadDuration: 3.2, // global loader, in seconds (not ms)
  loadDuration: 0, // global loader, in seconds (not ms)
};

// Cubic Bézier easing function (for cross-browser compatible animations)
export const cubicBezier = (p1x, p1y, p2x, p2y) => {
  // Example: const ease = cubicBezier(0.09, 0.9, 0.5, 1);
  return function (t) {
    t = Math.max(0, Math.min(1, t));

    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3;
    const y = 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3;

    return y;
  };
};

// Cubic-bezier - Lenis helper
export const cubicBezierLenis = (p0, p1, p2, p3) => {
  // Polyfill-like implementation of bezier easing
  return (t) => {
    const cx = 3 * p0;
    const bx = 3 * (p2 - p0) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1;
    const by = 3 * (p3 - p1) - cy;
    const ay = 1 - cy - by;

    const bezierX = (t) => ((ax * t + bx) * t + cx) * t;
    const bezierY = (t) => ((ay * t + by) * t + cy) * t;

    // Newton-Raphson to solve for t from x
    let x = t,
      i = 0;
    for (; i < 5; i++) {
      const x2 = bezierX(x) - t;
      if (Math.abs(x2) < 1e-4) break;
      const d2 = (3 * ax * x + 2 * bx) * x + cx;
      if (Math.abs(d2) < 1e-4) break;
      x -= x2 / d2;
    }
    return bezierY(x);
  };
};

// Back to top
{
  // Any element with the class 'back-to-top' will take you to the top (logo is the default target)
  const returnToTop = document.querySelectorAll("[class*=back-to-top]"),
    logo = document.querySelector(".site-header .site-logo");

  const customEase = cubicBezierLenis(0.6, 0, 0.25, 1);

  returnToTop.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();

      lenis.scrollTo(0, {
        duration: 1.5,
        easing: customEase,
      });

      logo.focus({ preventScroll: true });
    });
  });
}

// Smooth scroll for same-page anchor links (e.g. <a href="#section-id">)
{
  const customEase = cubicBezierLenis(0.6, 0, 0.25, 1);

  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]:not([href="#"])');
    if (!link) return;

    // Skip anything already handled (e.g. back-to-top) or opted out of
    if (
      link.matches("[class*=back-to-top]") ||
      link.hasAttribute("data-lenis-prevent")
    ) {
      return;
    }

    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();

    lenis.scrollTo(target, {
      duration: 1.5,
      easing: customEase,
    });

    history.pushState(null, "", `#${id}`);

    // Make the target focusable if it isn't already, for a11y
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  });
}

// Browser Check
export const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome");
};

document.addEventListener("DOMContentLoaded", () => {
  if (isSafari()) document.documentElement.dataset.browser = "safari";
});

// Dynamic update current year
{
  const currentYear = new Date().getFullYear();
  const currentYearElements = document.querySelectorAll("[data-current-year]");

  currentYearElements.forEach((currentYearElement) => {
    currentYearElement.textContent = currentYear;
    currentYearElement.setAttribute("datetime", currentYear);
  });
}

// Dropbox video url fix
{
  document.querySelectorAll("video").forEach((vid) => {
    const src = vid.getAttribute("src");

    if (src && src.includes("dropbox")) {
      const updatedSrc = src.replace("dl=0", "raw=1");
      vid.setAttribute("src", updatedSrc);
    }
  });
}

// Skip to main content option (for lenghthy headers)
{
  const skipToContent = document.querySelector(".skip-to-content"),
    contentStart = document.querySelector("#content-start");

  if (skipToContent) {
    skipToContent.addEventListener("click", () => {
      contentStart?.focus();
    });
  }
}

// CSS Util for .btn--split-text
{
  document.querySelectorAll(".btn--split-text").forEach((el) => {
    // Decide what to target
    const target = el.classList.contains("btn")
      ? el.querySelector(".btn__text")
      : el;

    if (!target) return;

    const text = target.textContent.trim();

    // Add aria-label for screen readers
    target.setAttribute("aria-label", text);

    // Build split markup (visually hidden from screen readers)
    const splitHTML =
      `<span class="btn--split-text__content" aria-hidden="true">` +
      Array.from(text)
        .map((char) => {
          if (char === " ") {
            return `<span class="letter-group space"> </span>`;
          }
          return `
            <span class="letter-group">
              <span class="letter" data-char="${char}">${char}</span>
            </span>
          `;
        })
        .join("") +
      `</span>`;

    // Replace only the text node inside the target, not the whole element
    target.innerHTML = splitHTML;
  });
}

// Polyfill for lvh, and svh. They all seemed to be dvh.
const setViewportUnits = (() => {
  const innerHeight = window.innerHeight;
  const lvhOffset = 64; // Mobile browser UI height (eyeballing)

  root.style.setProperty("--lvh", `${(innerHeight + lvhOffset) * 0.01}px`);
  root.style.setProperty("--svh", `${innerHeight * 0.01}px`);
})();

//
// Title change on tab move
//
// {
//   const originalTitle = document.title;

//   document.addEventListener("visibilitychange", () => {
//     if (document.hidden) {
//       document.title = "👋 Hey, come back!";
//     } else {
//       document.title = originalTitle;
//     }
//   });
// }

// console.clear();
// console.log("visit axyscreative.com for more info");

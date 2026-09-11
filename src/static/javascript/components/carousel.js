// Custom carousel — transform-based track.
//
// Props (set in carousel.njk, read here off data-attributes):
//   pagination : arrows | dots | none   — which controls to render
//   align      : start | center         — snap slide to the viewport's left
//                                         edge (default) or centre it, with the
//                                         previous / next slide cropped either side
//   loop       : data-carousel-loop     — infinite wrap (clones the slide set on
//                                         both sides; assumes uniform slide width)
//   autoplay   : data-carousel-autoplay — ms between auto-advances (0 = off)
//   drag       : data-carousel-drag     — pointer drag to scrub (default true)
//   dragThreshold : data-carousel-drag-threshold — fraction (0-1) of a slide's
//                                         width the drag must cross before it
//                                         commits to the next/prev slide
//                                         instead of snapping back (default 0.5)
//
// The start / non-loop / no-autoplay path is behaviour-identical to the
// original component (used by carousel-testimonial).

const carousels = document.querySelectorAll("[data-carousel]");
carousels.forEach(initCarousel);

function initCarousel(carousel) {
  const viewport = carousel.querySelector("[data-carousel-viewport]");
  const track = carousel.querySelector("[data-carousel-track]");
  const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
  if (!viewport || !track || !slides.length) return;

  const prevBtn = carousel.querySelector("[data-carousel-prev]");
  const nextBtn = carousel.querySelector("[data-carousel-next]");
  const dotsWrap = carousel.querySelector("[data-carousel-dots]");
  const dragEnabled = carousel.dataset.carouselDrag !== "false";
  const dragThresholdRaw = parseFloat(carousel.dataset.carouselDragThreshold);
  const dragThreshold = Number.isFinite(dragThresholdRaw)
    ? Math.min(Math.max(dragThresholdRaw, 0), 1)
    : 0.5;

  const centered = carousel.dataset.carouselAlign === "center";
  const autoplayMs = parseInt(carousel.dataset.carouselAutoplay, 10) || 0;
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const realCount = slides.length;
  const loop = carousel.dataset.carouselLoop === "true" && realCount > 1;

  // --- Loop: clone the whole set before and after the real slides, so the
  //     centred neighbours always have something to show and a step past
  //     either end lands on a clone we then silently snap back from. Relies on
  //     every slide being the same width (true in centre mode). ---------------
  if (loop) {
    const makeClone = (node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.removeAttribute("data-carousel-slide");
      clone.classList.add("carousel__slide--clone");
      return clone;
    };
    const head = document.createDocumentFragment();
    const tail = document.createDocumentFragment();
    slides.forEach((s) => tail.appendChild(makeClone(s)));
    slides.forEach((s) => head.appendChild(makeClone(s)));
    track.insertBefore(head, track.firstChild);
    track.appendChild(tail);
  }

  // Every <li> in DOM order (real slides + clones). `pos` indexes into this.
  const cells = Array.from(track.children);
  const firstReal = loop ? realCount : 0;

  let pos = firstReal; // index into `cells`
  let index = 0; // 0-based real slide (dots / aria)
  let offset = 0; // px the track is shifted left
  let maxScroll = 0;
  let interacted = false; // has any animated navigation happened yet?

  // Left edge of each cell relative to cell 0 (transform-independent).
  const cellStarts = () => {
    const base = cells[0].getBoundingClientRect().left;
    return cells.map((c) => c.getBoundingClientRect().left - base);
  };

  // The viewport can bleed past the section's content edge to the screen edge
  // (margin-inline-end: calc(50% - 50vw)). Reverse that overhang so the track
  // stops with the last slide flush to the content edge. Returns 0 when there's
  // no bleed (centre mode cancels it), so behaviour is unchanged there.
  const contentEdgeInset = () => {
    const m = parseFloat(getComputedStyle(viewport).marginInlineEnd) || 0;
    return m < 0 ? -m : 0;
  };

  const measure = () => {
    maxScroll = Math.max(
      0,
      track.scrollWidth - viewport.clientWidth + contentEdgeInset(),
    );
  };

  const trackHasTransition = () =>
    parseFloat(getComputedStyle(track).transitionDuration) > 0;

  // Target px offset for a cell position.
  const offsetForPos = (p) => {
    const starts = cellStarts();
    let target = starts[p];
    if (centered) {
      target +=
        cells[p].getBoundingClientRect().width / 2 - viewport.clientWidth / 2;
    }
    if (!loop) target = Math.min(Math.max(target, 0), maxScroll);
    return target;
  };

  const realIndexOf = (p) =>
    loop
      ? (((p - realCount) % realCount) + realCount) % realCount
      : Math.max(0, Math.min(p, realCount - 1));

  const apply = (animate = true) => {
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    // normalize()'s snap (apply(false)) swaps `is-current` between a clone
    // and its real counterpart at the same on-screen spot. Suppress the
    // slides' own opacity/filter transition too, or that swap cross-fades
    // and flashes even though the transform jump itself is instant.
    if (!animate && centered) {
      cells.forEach((c) => (c.style.transition = "none"));
    }

    if (centered) {
      cells.forEach((c, i) => c.classList.toggle("is-current", i === pos));
    }

    if (!animate) {
      // flush, then restore the stylesheet transitions
      void track.offsetWidth;
      track.style.transition = "";
      if (centered) {
        cells.forEach((c) => (c.style.transition = ""));
      }
    }

    if (prevBtn) prevBtn.disabled = !loop && offset <= 1;
    if (nextBtn) nextBtn.disabled = !loop && offset >= maxScroll - 1;

    if (dotsWrap) {
      dotsWrap.querySelectorAll(".carousel__dot").forEach((dot, i) => {
        const current = i === index;
        dot.setAttribute("aria-current", current ? "true" : "false");
        dot.classList.toggle("is-active", current);
      });
    }
  };

  // Bring `pos` back into the real-slide band with no visible move (the cell
  // one set away is pixel-identical because every slide is the same width).
  const normalize = () => {
    if (!loop) return;
    let p = pos;
    if (p < realCount) p += realCount;
    else if (p >= realCount * 2) p -= realCount;
    if (p !== pos) {
      pos = p;
      measure();
      offset = offsetForPos(pos);
      apply(false);
    }
  };

  let normalizeTimer;
  const goToPos = (p, animate = true) => {
    if (animate) interacted = true;
    measure();
    pos = loop ? p : Math.max(0, Math.min(p, cells.length - 1));
    index = realIndexOf(pos);
    offset = offsetForPos(pos);
    apply(animate);

    if (loop) {
      clearTimeout(normalizeTimer);
      if (animate && trackHasTransition()) {
        normalizeTimer = setTimeout(normalize, 700); // safety net for a missed transitionend
      } else {
        normalize();
      }
    }
  };

  // Address a real slide by index (dots, keyboard, non-loop arrows).
  const goTo = (i, animate = true) => {
    if (loop) {
      const wrapped = ((i % realCount) + realCount) % realCount;
      // Land on whichever equivalent cell (real band or a neighbouring clone
      // set) is closest to the current position, so wrapping across the
      // first/last boundary is a one-slide hop instead of a sweep across the
      // whole track. normalize() silently snaps it back into the real band
      // once the transition ends.
      let target = realCount + wrapped;
      const delta = target - pos;
      if (delta > realCount / 2) target -= realCount;
      else if (delta < -realCount / 2) target += realCount;
      goToPos(target, animate);
    } else {
      goToPos(i, animate);
    }
  };

  const step = (dir) => {
    if (loop) {
      goToPos(pos + dir, true);
    } else if (autoplayMs && dir > 0 && index >= realCount - 1) {
      goTo(0); // autoplay rewind when not looping
    } else {
      goTo(index + dir);
    }
  };

  const nearestPos = (px) => {
    const starts = cellStarts();
    let best = firstReal;
    let bestDist = Infinity;
    starts.forEach((start, i) => {
      let target = start;
      if (centered) {
        target +=
          cells[i].getBoundingClientRect().width / 2 - viewport.clientWidth / 2;
      }
      const dist = Math.abs(target - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  // --- Autoplay ----------------------------------------------------------------
  let autoplayTimer = null;
  const canAutoplay = autoplayMs > 0 && motionOK && realCount > 1;

  const startAutoplay = () => {
    if (!canAutoplay || autoplayTimer || document.hidden) return;
    autoplayTimer = setInterval(() => step(1), autoplayMs);
  };
  const stopAutoplay = () => {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  };
  // Restart the clock after a manual interaction so it doesn't fire immediately.
  const bumpAutoplay = () => {
    if (!canAutoplay) return;
    stopAutoplay();
    startAutoplay();
  };

  if (canAutoplay) {
    carousel.addEventListener("pointerenter", stopAutoplay);
    carousel.addEventListener("pointerleave", startAutoplay);
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", startAutoplay);
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stopAutoplay() : startAutoplay(),
    );
  }

  track.addEventListener("transitionend", (e) => {
    if (e.target !== track || e.propertyName !== "transform") return;
    clearTimeout(normalizeTimer);
    normalize();
  });

  // --- Controls --------------------------------------------------------------
  prevBtn?.addEventListener("click", () => {
    step(-1);
    bumpAutoplay();
  });
  nextBtn?.addEventListener("click", () => {
    step(1);
    bumpAutoplay();
  });

  if (dotsWrap) {
    for (let i = 0; i < realCount; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel__dot";
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
      dot.addEventListener("click", () => {
        goTo(i);
        bumpAutoplay();
      });
      dotsWrap.appendChild(dot);
    }
  }

  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
      bumpAutoplay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
      bumpAutoplay();
    }
  });

  // --- Drag ------------------------------------------------------------------
  if (dragEnabled) {
    let dragging = false;
    let startX = 0;
    let startOffset = 0;
    let moved = false;

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startOffset = offset;
      measure();
      stopAutoplay();
      carousel.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      offset = loop
        ? startOffset - dx
        : Math.max(0, Math.min(startOffset - dx, maxScroll));
      track.style.transition = "none";
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    // Where a drag release should land. `nearestPos` alone snaps at the ~50%
    // mark, which is used as-is for a flick that already crosses into
    // another slide's territory. When it doesn't (nearestPos keeps the
    // current slide), fall back to the configurable dragThreshold so a
    // shorter drag can still commit to the next/prev slide instead of
    // always snapping back.
    const dragTargetPos = () => {
      const nearest = nearestPos(offset);
      if (nearest !== pos) return nearest;

      const dir = offset > startOffset ? 1 : offset < startOffset ? -1 : 0;
      if (!dir) return pos;

      const stepWidth = Math.abs(offsetForPos(pos + dir) - offsetForPos(pos));
      if (
        stepWidth > 0 &&
        Math.abs(offset - startOffset) >= stepWidth * dragThreshold
      ) {
        return pos + dir;
      }
      return pos;
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      carousel.classList.remove("is-dragging");
      track.style.transition = "";
      if (viewport.hasPointerCapture?.(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      goToPos(dragTargetPos());
      bumpAutoplay();
    };

    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);

    // Swallow the click that follows a real drag so card links don't fire
    viewport.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      },
      true,
    );
  }

  // --- Lifecycle ----------------------------------------------------------------
  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => goToPos(pos, false));
  });

  cells.forEach((cell) => {
    const img = cell.querySelector("img");
    if (img && !img.complete) {
      // Re-snap to the (unchanged) current slide in case a late image load
      // shifted layout — but only pre-interaction. Once the user (or
      // autoplay) has actually navigated, every goToPos already remeasures
      // from scratch, so this is redundant, and calling it mid-transition
      // would yank the track out of its animated move and make it look like
      // the transition never played.
      img.addEventListener(
        "load",
        () => {
          if (!interacted) goToPos(pos, false);
        },
        { once: true },
      );
    }
  });

  goToPos(pos, false);
  startAutoplay();
}

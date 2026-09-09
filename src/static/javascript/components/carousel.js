// Custom carousel — transform-based track, "snap to left edge" per step.
// Supports: arrow controls, dot controls, pointer drag. One component,
// two pagination flavours (see carousel.njk `pagination: arrows | dots`).

const carousels = document.querySelectorAll("[data-carousel]");

carousels.forEach((carousel) => {
  const viewport = carousel.querySelector("[data-carousel-viewport]");
  const track = carousel.querySelector("[data-carousel-track]");
  const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
  if (!viewport || !track || !slides.length) return;

  const prevBtn = carousel.querySelector("[data-carousel-prev]");
  const nextBtn = carousel.querySelector("[data-carousel-next]");
  const dotsWrap = carousel.querySelector("[data-carousel-dots]");
  const dragEnabled = carousel.dataset.carouselDrag !== "false";

  let index = 0;
  let offset = 0; // current px the track is shifted left
  let maxScroll = 0;

  // Left edge of each slide relative to slide 0 (transform-independent, since
  // the track transform shifts every slide by the same amount).
  const slideStarts = () => {
    const base = slides[0].getBoundingClientRect().left;
    return slides.map((s) => s.getBoundingClientRect().left - base);
  };

  const measure = () => {
    maxScroll = Math.max(0, track.scrollWidth - viewport.clientWidth);
  };

  const clampIndex = (i) => Math.max(0, Math.min(i, slides.length - 1));

  const apply = (animate = true) => {
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    if (!animate) {
      // flush, then restore the stylesheet transition
      void track.offsetWidth;
      track.style.transition = "";
    }

    if (prevBtn) prevBtn.disabled = offset <= 1;
    if (nextBtn) nextBtn.disabled = offset >= maxScroll - 1;

    if (dotsWrap) {
      dotsWrap.querySelectorAll(".carousel__dot").forEach((dot, i) => {
        const current = i === index;
        dot.setAttribute("aria-current", current ? "true" : "false");
        dot.classList.toggle("is-active", current);
      });
    }
  };

  const goTo = (i, animate = true) => {
    measure();
    index = clampIndex(i);
    offset = Math.min(slideStarts()[index], maxScroll);
    apply(animate);
  };

  const nearestIndex = (px) => {
    const starts = slideStarts();
    let best = 0;
    let bestDist = Infinity;
    starts.forEach((start, i) => {
      const dist = Math.abs(start - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  // --- Controls -------------------------------------------------------------
  prevBtn?.addEventListener("click", () => goTo(index - 1));
  nextBtn?.addEventListener("click", () => goTo(index + 1));

  if (dotsWrap) {
    slides.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel__dot";
      dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
      dot.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(dot);
    });
  }

  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    }
  });

  // --- Drag --------------------------------------------------------------------
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
      carousel.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      offset = Math.max(0, Math.min(startOffset - dx, maxScroll));
      track.style.transition = "none";
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      carousel.classList.remove("is-dragging");
      track.style.transition = "";
      if (viewport.hasPointerCapture?.(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      goTo(nearestIndex(offset));
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

  // --- Lifecycle ------------------------------------------------------------
  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => goTo(index, false));
  });

  slides.forEach((slide) => {
    const img = slide.querySelector("img");
    if (img && !img.complete) {
      img.addEventListener("load", () => goTo(index, false), { once: true });
    }
  });

  goTo(0, false);
});

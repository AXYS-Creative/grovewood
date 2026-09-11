import { mqNoMotion } from "../util.js";
gsap.registerPlugin(ScrollTrigger);

// Counter component (Default values are declared in .njk component)

const counters = document.querySelectorAll(".counter");

counters.forEach((el) => {
  const valueWrapper = el.querySelector(".counter__value");
  const digitEl = el.querySelector(".counter__value-digit"); // stable hook

  const prefixText =
    el.querySelector(".counter__value-prefix")?.textContent ?? "";
  const suffixText =
    el.querySelector(".counter__value-suffix")?.textContent ?? "";
  const endValue = parseFloat(el.dataset.counterNumber);
  const duration =
    Math.max(0, parseInt(el.dataset.counterDuration, 10) || 0) / 1000;
  const runOnce = el.dataset.counterOnce === "true";
  const comma = el.dataset.counterComma === "true";
  const ticker = digitEl.classList.contains("counter__value-digit--ticker");

  if (isNaN(endValue) || !digitEl) return;

  const isWholeNumber = Number.isInteger(endValue);
  const snapValue = isWholeNumber ? 1 : 0.1;

  const formatValue = (num) => {
    if (comma) {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: isWholeNumber ? 0 : 1,
        maximumFractionDigits: isWholeNumber ? 0 : 1,
      });
    } else {
      return isWholeNumber ? Math.round(num).toString() : num.toFixed(1);
    }
  };

  const finalFormatted = formatValue(endValue);
  const estimatedText = `${prefixText}${finalFormatted}${suffixText}`;
  valueWrapper.style.width = `${estimatedText.length}.25ch`;

  let hasPlayed = false;

  // Numeric mode (unchanged)
  if (!ticker) {
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: endValue,
      duration,
      ease: "power1.out",
      snap: { val: snapValue },
      paused: true,
      onUpdate: () => (digitEl.textContent = formatValue(obj.val)),
    });

    if (mqNoMotion) {
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        once: true,
        onEnter: () => (digitEl.textContent = finalFormatted),
      });
    } else {
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        once: runOnce,
        onEnter: () => {
          if (!runOnce || !hasPlayed) {
            tween.play();
            hasPlayed = true;
          }
        },
        onLeave: () => {
          if (!runOnce) {
            tween.pause(0);
            digitEl.textContent = "0";
          }
        },
        onEnterBack: () => {
          if (!runOnce) tween.restart(0);
        },
        onLeaveBack: () => {
          if (!runOnce) {
            tween.pause(0);
            digitEl.textContent = "0";
            hasPlayed = false;
          }
        },
      });
    }
    return;
  }

  // Ticker mode (prebuild timeline at init)
  const wrapDigits = (targetStr) => {
    const parts = Array.from(targetStr).map((ch) =>
      /\d/.test(ch)
        ? `<span class="digit" data-counter-value="${ch}">
               <span class="sequence">0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</span>
             </span>`
        : ch,
    );
    digitEl.innerHTML = parts.join("");
    digitEl.setAttribute("data-wrapped", "true");
    digitEl.setAttribute("data-final-text", targetStr);
  };

  if (
    digitEl.getAttribute("data-wrapped") !== "true" ||
    digitEl.getAttribute("data-final-text") !== finalFormatted
  ) {
    digitEl.textContent = finalFormatted; // sizing
    wrapDigits(finalFormatted);
  }

  const sequences = digitEl.querySelectorAll(".sequence");
  // Guard against CSS transitions causing delay
  gsap.set(sequences, { yPercent: 0, willChange: "transform" });

  const tl = gsap.timeline({
    paused: true,
    defaults: { lazy: false },
  });

  digitEl.querySelectorAll(".digit").forEach((digit) => {
    const value = parseInt(digit.getAttribute("data-counter-value"), 10) || 0;
    tl.to(digit.querySelector(".sequence"), { yPercent: -(value * 10) }, 0);
  });

  // stash for callbacks
  el._tickerTl = tl;

  if (mqNoMotion) {
    ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      once: true,
      onEnter: () => tl.progress(1).pause(),
    });
  } else {
    ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      once: runOnce,
      invalidateOnRefresh: true,
      onEnter: () => {
        if (!runOnce || !hasPlayed) {
          tl.play(0);
          hasPlayed = true;
        }
      },
      onLeave: () => {
        if (!runOnce) tl.progress(0).pause();
      },
      onEnterBack: () => {
        if (!runOnce) tl.play(0);
      },
      onLeaveBack: () => {
        if (!runOnce) {
          tl.progress(0).pause();
          hasPlayed = false;
        }
      },
    });
  }
});

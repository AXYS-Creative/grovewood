// Similar logic shared between text animations with slightly different effects

let responsiveGsap = gsap.matchMedia();

responsiveGsap.add(
  {
    maxSm: "(max-width: 480px)",
    minMd: "(min-width: 769px)",
  },
  (context) => {
    let { maxSm } = context.conditions;

    // Text Fade
    {
      const fadeElems = document.querySelectorAll(".text-fade");

      fadeElems.forEach((el) => {
        const fadeType = el.dataset.fadeType || "words"; // "chars" or "words"
        const fadeStyle = el.dataset.fadeStyle || "random"; // "linear" or "random"
        const fadeDuration = parseFloat(el.dataset.fadeDuration) || 0.25;
        const fadeScrub = el.dataset.fadeScrub === "true"; // default false
        const fadeOnce = !fadeScrub && el.dataset.fadeOnce === "true"; // only if scrub is false
        const fadeStart = el.dataset.fadeStart || "top 98%";
        const fadeEnd = el.dataset.fadeEnd || "bottom 2%";
        const fadeMarkers = el.dataset.fadeMarkers || false;

        const split = new SplitText(el, {
          type: fadeType,
          [`${fadeType}Class`]: `text-fade__${fadeType}`,
          tag: "span",
        });

        const targets = fadeType === "words" ? split.words : split.chars;

        const scrollTriggerConfig = {
          trigger: el,
          start: fadeStart,
          end: fadeEnd,
          scrub: fadeScrub || false,
          markers: fadeMarkers,
        };

        if (!fadeScrub) {
          scrollTriggerConfig.toggleActions = fadeOnce
            ? "play none none none"
            : "play reset play reset";

          scrollTriggerConfig.onEnter = () =>
            el.classList.add("text-fade--active");

          scrollTriggerConfig.onLeaveBack = () => {
            if (!fadeOnce) el.classList.remove("text-fade--active");
          };

          scrollTriggerConfig.once = fadeOnce;
        }

        const tl = gsap.timeline({ scrollTrigger: scrollTriggerConfig });

        tl.fromTo(
          fadeStyle === "random" ? gsap.utils.shuffle(targets) : targets,
          { opacity: 0 },
          {
            opacity: 1,
            duration: fadeDuration,
            stagger: 0.0125,
            ease: "linear",
          },
        );
      });
    }

    // Text Fill
    {
      const fillTextElems = document.querySelectorAll(".text-fill");

      fillTextElems.forEach((el) => {
        const scrubVal = el.dataset.fillScrub;
        const onceVal = el.dataset.fillOnce;
        const durationVal = el.dataset.fillDuration || 1;
        const markersVal = el.dataset.fillMarkers === "true";

        const scrub = scrubVal !== "false"; // default true
        const once = onceVal === "true"; // default false

        // Defaults change based on scrub true or false
        const defaultStart = scrub ? "top 90%" : "top 98%";
        const defaultEnd = scrub ? "bottom 60%" : "bottom 2%";

        const startVal = el.dataset.fillStart || defaultStart;
        const endVal = el.dataset.fillEnd || defaultEnd;

        const scrollTrigger = {
          trigger: el,
          start: startVal,
          end: endVal,
          ...(scrub
            ? { scrub }
            : {
                toggleActions: once
                  ? "play none none none"
                  : "play reset play reset",
              }),
          markers: markersVal,
        };

        gsap.fromTo(
          el,
          { backgroundSize: "0%" },
          {
            backgroundSize: "100%",
            scrollTrigger,
            ...(scrub ? {} : { duration: durationVal }),
          },
        );
      });
    }

    // Text Reveal
    {
      const revealElems = document.querySelectorAll(".text-reveal");

      revealElems.forEach((el) => {
        const revealType = el.dataset.revealType || "words"; // 'words' | 'chars'
        const revealFrom = el.dataset.revealFrom || "bottom"; // 'bottom' | 'top'
        const revealDuration = parseFloat(el.dataset.revealDuration) || 0.2;
        const revealStagger = parseFloat(el.dataset.revealStagger) || 0.05;
        const revealEase = el.dataset.revealEase || "linear";
        const revealScrub = el.dataset.revealScrub === "true"; // default false
        const revealOnce = !revealScrub && el.dataset.revealOnce === "true"; // only if scrub is false
        const revealStart = el.dataset.revealStart || "top 98%";
        const revealEnd = el.dataset.revealEnd || "bottom 2%";
        const revealMarkers = el.dataset.revealMarkers || false;

        const split = new SplitText(el, {
          type: revealType,
          [`${revealType}Class`]: `text-reveal__${revealType}`,
          tag: "span",
        });

        const targets = revealType === "words" ? split.words : split.chars;

        targets.forEach((target) => {
          const wrapper = document.createElement("span");
          wrapper.classList.add("outer-span");
          target.parentNode.insertBefore(wrapper, target);
          wrapper.appendChild(target);
        });

        const scrollTriggerConfig = {
          trigger: el,
          start: revealStart,
          end: revealEnd,
          scrub: revealScrub || false,
          markers: revealMarkers,
        };

        if (!revealScrub) {
          scrollTriggerConfig.toggleActions = revealOnce
            ? "play none none none"
            : "play reset play reset";

          scrollTriggerConfig.onEnter = () =>
            el.classList.add("text-reveal--active");

          scrollTriggerConfig.onLeaveBack = () => {
            if (!revealOnce) el.classList.remove("text-reveal--active");
          };

          scrollTriggerConfig.once = revealOnce;
        }

        const tl = gsap.timeline({ scrollTrigger: scrollTriggerConfig });

        tl.fromTo(
          targets,
          { y: revealFrom === "top" ? "-100%" : "100%" },
          {
            y: "0",
            duration: revealDuration,
            stagger: revealStagger,
            ease: revealEase,
          },
        );
      });
    }

    // Text Scale
    {
      const scaleElems = document.querySelectorAll(".text-scale");

      scaleElems.forEach((el) => {
        const scaleType = el.dataset.scaleType || "words"; // "chars" or "words"
        const scaleStyle = el.dataset.scaleStyle || "random"; // "linear" or "random"
        const scaleDuration = parseFloat(el.dataset.scaleDuration) || 0.25;
        const scaleScrub = el.dataset.scaleScrub === "true";
        const scaleOnce = !scaleScrub && el.dataset.scaleOnce === "true";
        const scaleTrigger = el.dataset.scaleTrigger || el; // Requires . or #
        const scaleStart = el.dataset.scaleStart || "top 98%";
        const scaleEnd = el.dataset.scaleEnd || "bottom 2%";
        const scaleMarkers = el.dataset.scaleMarkers || false;

        const split = new SplitText(el, {
          type: scaleType,
          [`${scaleType}Class`]: `text-scale__${scaleType}`,
          tag: "span",
        });

        const targets = scaleType === "words" ? split.words : split.chars;

        // Calculate transform-origin based on each element’s position
        const parentBox = el.getBoundingClientRect();
        targets.forEach((word) => {
          const box = word.getBoundingClientRect();
          const centerX =
            (box.left + box.width / 2 - parentBox.left) / parentBox.width;

          // Map 0–1 range to useful values for transform-origin
          // left edge = "0% 50%", right edge = "100% 50%", middle = "50% 50%"
          const originX = `${Math.round((1 - centerX) * 100)}%`;
          word.style.transformOrigin = `${originX} 50%`;
        });

        const scrollTriggerConfig = {
          trigger: scaleTrigger,
          start: scaleStart,
          end: scaleEnd,
          scrub: scaleScrub || false,
          markers: scaleMarkers,
        };

        if (!scaleScrub) {
          scrollTriggerConfig.toggleActions = scaleOnce
            ? "play none none none"
            : "play reset play reset";

          scrollTriggerConfig.onEnter = () =>
            el.classList.add("text-scale--active");

          scrollTriggerConfig.onLeaveBack = () => {
            if (!scaleOnce) el.classList.remove("text-scale--active");
          };

          scrollTriggerConfig.once = scaleOnce;
        }

        const tl = gsap.timeline({ scrollTrigger: scrollTriggerConfig });

        tl.fromTo(
          scaleStyle === "random" ? gsap.utils.shuffle(targets) : targets,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: scaleDuration,
            stagger: 0.0125,
            ease: "linear",
          },
        );
      });
    }

    // Typing Text Effects
    {
      const injectTypingElements = (el, cursorType) => {
        const typingSpan = document.createElement("span");
        typingSpan.classList.add("typing-text");
        el.textContent = "";
        el.appendChild(typingSpan);

        const cursorSpan = document.createElement("span");
        cursorSpan.classList.add("typing-text-cursor");
        setupCursorSpan(cursorSpan, cursorType);
        el.appendChild(cursorSpan);

        return { typingSpan, cursorSpan };
      };

      const setupCursorSpan = (cursorSpan, cursorType) => {
        if (cursorType === "caret") {
          cursorSpan.textContent = "|";
        } else if (cursorType === "underscore") {
          cursorSpan.textContent = "_";
        } else if (cursorType === "none") {
          cursorSpan.style.display = "none";
        } else {
          cursorSpan.textContent = "|";
        }
      };

      // Typing Cycle
      const typingCycleElems = document.querySelectorAll(".typing-cycle");

      typingCycleElems.forEach((el) => {
        const words = el.dataset.typingCycleWords
          .split(",")
          .map((w) => w.trim());
        const colors = (el.dataset.typingCycleColors || "")
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c);

        const speedIn = parseInt(el.dataset.typingSpeedIn, 10) || 120;
        const speedOut = parseInt(el.dataset.typingSpeedOut, 10) || 50;
        const interval = parseInt(el.dataset.typingCycleInterval, 10) || 2000;
        const cursorType = el.dataset.typingCursor || "caret";
        const delay = parseInt(el.dataset.typingDelay, 10) || 0;
        const onScroll = el.dataset.typingOnScroll === "true";
        let hasStarted = false;

        const { typingSpan } = injectTypingElements(el, cursorType);

        let wordIndex = 0;
        let charIndex = 0;
        let isDeleting = false;

        const type = () => {
          const currentWord = words[wordIndex];
          const displayedText = isDeleting
            ? currentWord.substring(0, charIndex--)
            : currentWord.substring(0, charIndex++);

          typingSpan.textContent = displayedText;

          if (!isDeleting && charIndex === 1 && colors.length) {
            const currentColor = colors[wordIndex % colors.length];
            typingSpan.style.color = currentColor;
          }

          if (!isDeleting && charIndex > currentWord.length) {
            setTimeout(() => {
              isDeleting = true;
              type();
            }, interval);
          } else if (isDeleting && charIndex < 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            charIndex = 0;
            type();
          } else {
            const baseSpeed = isDeleting ? speedOut : speedIn;
            const humanizedDelay = baseSpeed + Math.random() * 100 - 50;
            setTimeout(type, Math.max(humanizedDelay, 20));
          }
        };

        if (onScroll) {
          ScrollTrigger.create({
            trigger: el,
            start: "top bottom",
            onEnter: () => {
              if (!hasStarted) {
                hasStarted = true;
                setTimeout(type, delay);
              }
            },
            onEnterBack: () => {
              if (!hasStarted) {
                hasStarted = true;
                setTimeout(type, delay);
              }
            },
          });
        } else {
          setTimeout(type, delay);
        }
      });

      // Typing Scroll
      const typingScrollElems = document.querySelectorAll(".typing-scroll");

      typingScrollElems.forEach((el) => {
        if (!el.dataset.originalText) {
          el.dataset.originalText = el.textContent.trim();
        }
        const speed = parseInt(el.dataset.typingSpeed, 10) || 50;
        const once = el.dataset.typingOnce === "true";
        const cursorType = el.dataset.typingCursor || "caret";
        const delay = parseInt(el.dataset.typingDelay, 10) || 0;

        const { typingSpan } = injectTypingElements(el, cursorType);

        let hasStarted = false;
        let timeoutId;

        const typeOut = () => {
          if (once && hasStarted) return;

          if (timeoutId) clearTimeout(timeoutId);

          hasStarted = true;
          typingSpan.textContent = "";
          let charIndex = 0;
          const text = el.dataset.originalText;

          const typeChar = () => {
            if (charIndex < text.length) {
              typingSpan.textContent += text.charAt(charIndex++);
              const charDelay = speed + Math.random() * 40 - 20;
              timeoutId = setTimeout(typeChar, Math.max(charDelay, 20));
            }
          };

          timeoutId = setTimeout(typeChar, delay);
        };

        const stopTyping = () => {
          if (!once && timeoutId) {
            clearTimeout(timeoutId);
          }
        };

        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          onEnter: typeOut,
          onEnterBack: typeOut,
          onLeave: stopTyping,
          onLeaveBack: stopTyping,
        });
      });
    }
  },
);

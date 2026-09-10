// ─────────────────────────────────────────────────────────────────────────
// WebGL background — deep navy field, drifting light lobes, diagonal crease,
// vignette, film grain. Lobes drift and gently form/dissolve at randomized,
// independent rates, and push in the direction of cursor travel. Supports
// two optional theme-reactivity modes (toggle-based and section-scroll
// based), both opt-in via canvas attributes. Grain and crease are static.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const canvas = document.querySelector(".dust-bg");
  if (!canvas) return;

  // Small helper to accept hex or rgba() strings and pre-parse to [r,g,b] floats
  function css(input) {
    if (input.startsWith("#")) {
      let hex = input.slice(1);
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      const int = parseInt(hex, 16);
      return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
      ];
    }
    const m = input.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    }
    return [0, 0, 0];
  }

  const MAX_LOBES = 4;

  // ── Tunables ────────────────────────────────────────────────────────────
  const CFG = {
    // Debug — temporary visualization aids, safe to leave false in production
    debug: {
      turbulenceView: false, // true = show the raw turbulence field full-screen, bypassing glow masking
    },

    // Stationary concentric ripples, originating above the viewport, that
    // "cut" the light gradient into discrete bands. Mechanism: each ring
    // resamples the lobe glow at a position shifted by a fixed amount for
    // that ring index — a discrete (stepped), not continuous, shift — so
    // the smooth gradient alternates between bright/dark territory at each
    // ring boundary instead of blending smoothly. Only affects the lobe
    // glow calculation; mouse tracking, turbulence, crease, and vignette
    // all still read the true, unwarped pixel position.
    ripple: {
      enabled: true, // master on/off — flipping this doesn't touch the tuned values below
      centerX: 0.0, // horizontal position of the ripple origin, canvas-space (0 = center)
      centerY: 1.4, // vertical position of the origin — positive is above the visible top edge
      spacing: 0.18, // distance between ring boundaries (larger = thicker/fewer visible bands)
      shiftAmount: 0.85, // how far the sampled gradient jumps between adjacent shift states — this is what creates the visible "cut"
      cycleCount: 1, // 1.075 is clean number of distinct shift states the rings cycle through (bounds the total shift so it can't grow unboundedly far from the scene)
    },

    // Color palettes — "dark" is the current/default look. "light" is a
    // starting placeholder; tune it to match your site's actual light theme.
    colors: {
      dark: {
        baseColor: css("#fbfcfd"),
        highlightColor: css("#e9f4ea"),
      },
      light: {
        baseColor: css("#f8fbfc"), // sampled from the light-theme reference (edges/corners)
        highlightColor: css("#39a2d7"), // sampled from the reference (center glow)
      },
    },

    // Theme reactivity — opt-in only. If the canvas has this attribute,
    // the background watches document.documentElement's data-theme
    // (set by theme-toggle.js) and swaps colors.dark/colors.light to match.
    // If the attribute is absent, this is skipped entirely — no observer,
    // no reads, identical to current behavior.
    theme: {
      toggleAttribute: "data-theme-toggle",
      transitionSpeed: 0.04, // per-frame easing for the toggle-based crossfade (section-based tracks scroll directly, no lag)

      // Section-based scroll theming — opt-in via this attribute on the canvas.
      sectionAttribute: "data-section-theme",
      sectionThemeAttr: "data-canvas-theme", // e.g. data-canvas-theme="light" on a <section>
      sectionStartAttr: "data-canvas-start", // e.g. data-canvas-start="0.5" — single flip threshold (defaults to 0.5)
    },

    // Lobe field — the soft moving glows
    lobes: {
      count: 3, // 1–4
      driftRadius: 0.46, // how far each lobe wanders from its base position
      radiusBase: 0.3, // average glow radius
      radiusVariance: 0.14, // +/- randomization per lobe
      formMin: 0.12, // lowest opacity a lobe dips to (0 = fully dissolves)
    },

    // Master motion speed — scales both drift and form/dissolve pulsing.
    // 0 = frozen (same as the static version), 1 = default pace.
    motionSpeed: 3.5,

    // How long the lobes (and turbulence, which shares their glow) take to
    // fade in on load. Tied to real elapsed time, not motionSpeed-scaled
    // time, so it's always this exact duration regardless of that setting.
    loadFadeInDuration: 3,

    // Flowing turbulence — a fine sparkling texture, separate from the
    // static base grain, that drifts left-to-right and is masked to only
    // show up in already-lit areas (per the reference clip: the motion
    // reads as fine grain drifting within the bright band, not the big
    // soft gradient itself moving).
    turbulence: {
      speed: 0.0075, // how fast the sparkle drifts left-to-right
      scale: 520.0, // frequency of the speckle (higher = finer grain)
      intensity: 0.08, // brightness of the flowing sparkle
      curlAmount: 0.5, // subtle vertical wobble as it drifts, for an organic (non-straight) flow
      curlScale: 3.5, // spatial frequency of that wobble
    },

    // Mouse interaction — lobes get pushed away from the cursor, and get a
    // local brightness boost near it. Position and influence strength are
    // both eased, never velocity-based.
    mouse: {
      radius: 0.35, // effective radius of cursor influence for push proximity
      glowRadius: 0.25, // size of the light that tracks the cursor (independent of `radius`)
      pushStrength: 0.14, // how far lobes get displaced in the direction of cursor travel
      glowBoost: 0.12, // extra brightness added directly under the cursor
      positionSmoothing: 0.08, // per-frame easing toward the cursor's real position (lower = smoother/laggier)
      influenceSmoothing: 0.05, // per-frame easing for the effect fading in/out on enter/leave

      // Lobes only — independent from the turbulence velocity config below.
      lobeVelocityReference: 1.2, // cursor speed (screen-units/sec) at which lobe push reaches full strength
      lobeVelocitySmoothing: 0.15, // per-frame easing when speed is increasing (attack)
      lobeVelocityRestoreSmoothing: 0.03, // per-frame easing when speed is decreasing (release)

      // Turbulence only — independent from the lobe velocity config above.
      turbMouseEnabled: false, // master on/off for the grain's mouse push/trail. Light tracking and lobe push are unaffected either way.
      velocityReference: 1.2, // cursor speed (screen-units/sec) at which turbulence push reaches full strength
      velocitySmoothing: 0.15, // per-frame easing when speed is increasing (attack — how fast push ramps up)
      velocityRestoreSmoothing: 0.03, // per-frame easing when speed is decreasing (release — how slowly push fades/restores once you stop; lower = lingers longer)
      turbDirectionSmoothing: 0.08, // per-frame easing of the turbulence push/trail direction only — lower = more "momentum" on a sharp reversal, higher = snappier/more instant

      turbRadius: 0.3, // radius of the repulsion zone around the cursor (independent of `radius`/`glowRadius`)
      turbPushStrength: 0.08, // how far grains get repelled radially outward from the cursor
      turbTrailStrength: 0.06, // how strongly grain is pulled into the trailing wake behind the cursor (the "inverse" of the front push)
      turbTrailLength: 1.8, // how far behind the cursor the trail extends, as a multiple of turbRadius
      turbEdgeNoise: 0.35, // how irregular the effect's boundary is (0 = perfect circle/arc, higher = organic wobbly edge)
      turbSwapPushPull: false, // false = front pushes away / trail pulls in (default). true = front pulls in / trail pushes away.
    },

    // Diagonal crease (the soft shadow band sweeping through the upper right)
    creaseAngle: -20, // degrees
    creaseOffset: 0.08,
    creaseWidth: 0.24,
    creaseStrength: 0.12,

    // Vignette
    vignetteStart: 0.15,
    vignetteEnd: 0.95,
    vignetteStrength: 0.55,

    // Film grain (static, per-pixel, not time-based)
    grainIntensity: 0.035,
  };

  // ── WebGL setup ─────────────────────────────────────────────────────────
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL not supported");

  const vertSrc = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

  const fragSrc = `
  precision highp float;
  #define MAX_LOBES ${MAX_LOBES}

  uniform vec2 uResolution;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform float uTime;

  uniform vec2 uLobeBasePos[MAX_LOBES];
  uniform vec2 uLobeDriftFreq[MAX_LOBES];
  uniform vec2 uLobePhase[MAX_LOBES];
  uniform float uLobeDriftAmp[MAX_LOBES];
  uniform float uLobeRadius[MAX_LOBES];
  uniform float uLobeFormFreq[MAX_LOBES];
  uniform float uLobeFormPhase[MAX_LOBES];
  uniform float uLobeFormMin;
  uniform int uLobeCount;
  uniform float uLoadFadeIn;

  uniform vec2 uRippleCenter;
  uniform float uRippleSpacing;
  uniform float uRippleShift;
  uniform float uRippleCycleCount;
  uniform float uRippleEnabled;

  uniform vec2 uMousePos;
  uniform float uMouseInfluence;
  uniform float uMouseRadius;
  uniform float uMouseGlowRadius;
  uniform float uMousePushStrength;
  uniform float uMouseGlowBoost;
  uniform vec2 uMouseVelocityDir;
  uniform vec2 uMouseTurbDir;
  uniform float uMouseVelocityFactor;
  uniform float uMouseTurbVelocityFactor;

  uniform float uCreaseAngle;
  uniform float uCreaseOffset;
  uniform float uCreaseWidth;
  uniform float uCreaseStrength;
  uniform float uVignetteStart;
  uniform float uVignetteEnd;
  uniform float uVignetteStrength;
  uniform float uGrainIntensity;

  uniform float uTurbSpeed;
  uniform float uTurbScale;
  uniform float uTurbIntensity;
  uniform float uTurbCurlAmount;
  uniform float uTurbCurlScale;
  uniform float uMouseTurbRadius;
  uniform float uMouseTurbPushStrength;
  uniform float uMouseTurbTrailStrength;
  uniform float uMouseTurbTrailLength;
  uniform float uMouseTurbEdgeNoise;
  uniform float uMouseTurbSwap;
  uniform float uDebugTurbView;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Smoothly-interpolated noise — unlike raw hash(), this has spatial
  // continuity (soft blobs instead of per-cell static), which is what
  // lets a coordinate push actually read as visible motion.
  float valueNoise(vec2 coord) {
    vec2 i = floor(coord);
    vec2 f = fract(coord);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }


  void main() {
    // Centered, aspect-normalized coordinate space
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    // Stationary ripple warp — only used for lobe glow sampling below,
    // nothing else. The shift cycles through a small number of states
    // (bounded via mod) rather than growing with raw ring index — an
    // unbounded shift at high ring counts was pushing the sample position
    // miles away from every lobe, collapsing glow to zero everywhere.
    vec2 rippleToPixel = p - uRippleCenter;
    float rippleDist = length(rippleToPixel);
    vec2 rippleDir = rippleDist > 0.0001 ? rippleToPixel / rippleDist : vec2(0.0, 1.0);
    float rippleRingIndex = floor(rippleDist / uRippleSpacing);
    float rippleCycle = mod(rippleRingIndex, uRippleCycleCount);
    vec2 pRippled = p + rippleDir * rippleCycle * uRippleShift * uRippleEnabled;

    // Accumulate drifting, forming/dissolving lobes
    float totalLobe = 0.0;
    for (int i = 0; i < MAX_LOBES; i++) {
      if (i >= uLobeCount) break;

      vec2 pos = uLobeBasePos[i] + uLobeDriftAmp[i] * vec2(
        sin(uTime * uLobeDriftFreq[i].x + uLobePhase[i].x),
        cos(uTime * uLobeDriftFreq[i].y + uLobePhase[i].y)
      );

      // Push this lobe in the direction of cursor travel — only while moving
      float mDist = length(pos - uMousePos);
      float mProximity = smoothstep(uMouseRadius, 0.0, mDist) * uMouseInfluence;
      float mPush = mProximity * uMouseVelocityFactor;
      pos += uMouseVelocityDir * mPush * uMousePushStrength;

      float pulse = 0.5 + 0.5 * sin(uTime * uLobeFormFreq[i] + uLobeFormPhase[i]);
      float envelope = mix(uLobeFormMin, 1.0, pulse * sqrt(pulse));

      float d = length(pRippled - pos);
      float g = exp(-(d * d) / (2.0 * uLobeRadius[i] * uLobeRadius[i]));

      totalLobe += g * envelope;
    }

    // Soft clamp so overlapping lobes don't blow out to flat white
    // Fades from 0 to 1 over the first 0.5s on load — cascades naturally to
    // turbulence too, since it's masked by this same glow value.
    float glow = (1.0 - exp(-totalLobe)) * uLoadFadeIn;
    vec3 color = mix(uBaseColor, uHighlightColor, clamp(glow, 0.0, 1.0));

    // Direct brightness boost right under the cursor
    float mouseGlowDist = length(p - uMousePos);
    float mouseGlowFalloff = exp(-(mouseGlowDist * mouseGlowDist) / (2.0 * uMouseGlowRadius * uMouseGlowRadius)) * uMouseInfluence;
    color += uHighlightColor * uMouseGlowBoost * mouseGlowFalloff;

    // Diagonal crease / shadow sweep (static)
    float rad = radians(uCreaseAngle);
    float ca = cos(rad);
    float sa = sin(rad);
    float along = p.x * ca - p.y * sa;
    float crease = smoothstep(uCreaseOffset, uCreaseOffset + uCreaseWidth, along)
                 * (1.0 - smoothstep(uCreaseOffset + uCreaseWidth, uCreaseOffset + uCreaseWidth * 2.2, along));
    color -= crease * uCreaseStrength;

    // Vignette
    float r = length(p);
    float vig = 1.0 - uVignetteStrength * smoothstep(uVignetteStart, uVignetteEnd, r);
    color *= vig;

    // Flowing turbulence — fine sparkle drifting left-to-right, masked to
    // only show up where it's already lit (glow), matching the reference.
    // Repelled from the cursor, but only in front of its travel direction
    // (not a full circle), and only while actually moving — resting the
    // cursor shows nothing at all. A trailing wake behind the cursor does
    // the inverse (pulls grain toward the path instead of away).
    vec2 turbP = p;
    vec2 toPoint = p - uMousePos;
    float turbMDist = length(toPoint);
    vec2 turbRepelDir = turbMDist > 0.0001 ? toPoint / turbMDist : vec2(0.0, 1.0);
    float travelDot = dot(turbRepelDir, uMouseTurbDir); // 1 = directly ahead, -1 = directly behind

    // Perturb the radius by angle (and slowly over time) so the boundary
    // reads as an organic, irregular blob instead of a clean geometric arc.
    float edgeN = valueNoise(turbRepelDir * 4.0 + vec2(uTime * 0.08, 17.0)) * 2.0 - 1.0;
    float frontRadius = uMouseTurbRadius * (1.0 + edgeN * uMouseTurbEdgeNoise);
    float trailRadius = frontRadius * uMouseTurbTrailLength;

    float frontWeight = max(0.0, travelDot);
    float trailWeight = max(0.0, -travelDot);

    // Single smooth falloff per zone, no plateau — avoids the banding from before.
    float frontProximity = smoothstep(frontRadius, 0.0, turbMDist) * frontWeight * uMouseInfluence;
    float trailProximity = smoothstep(trailRadius, 0.0, turbMDist) * trailWeight * uMouseInfluence;

    // Velocity-gated — zero at rest, so the effect only appears while moving.
    float frontPush = frontProximity * uMouseTurbVelocityFactor;
    float trailPull = trailProximity * uMouseTurbVelocityFactor;

    // Hard safety cap on both: the displacement can never exceed a fraction
    // of the pixel's actual distance to the cursor, so the sample point can
    // never overshoot past it and fold/mirror — that overshoot was the
    // exact mechanism behind the lensing/pinching layers before.
    float safeFrontAmount = min(uMouseTurbPushStrength, turbMDist * 0.8) * frontPush;
    float safeTrailAmount = min(uMouseTurbTrailStrength, turbMDist * 0.8) * trailPull;

    // Front normally pushes away (subtract), trail normally pulls in (add).
    // uMouseTurbSwap flips both signs, swapping which zone does which,
    // without touching the geometry (radii, shape, edge noise) at all.
    float frontSign = uMouseTurbSwap > 0.5 ? 1.0 : -1.0;
    float trailSign = uMouseTurbSwap > 0.5 ? -1.0 : 1.0;
    turbP += turbRepelDir * (safeFrontAmount * frontSign + safeTrailAmount * trailSign);

    vec2 flowCoord = turbP * uTurbScale;
    flowCoord.x -= uTime * uTurbSpeed * uTurbScale;
    flowCoord.y += sin(turbP.x * uTurbCurlScale + uTime * uTurbSpeed * 0.6) * uTurbCurlAmount * uTurbScale;
    float turb = valueNoise(flowCoord);

    // Debug view: shows the raw turbulence field full-screen, completely
    // unmasked by glow, so the push mechanic can be checked in isolation
    // from "is this area lit enough to show it." Toggle via CFG.debug.
    if (uDebugTurbView > 0.5) {
      gl_FragColor = vec4(vec3(turb), 1.0);
      return;
    }

    color += vec3(turb) * uTurbIntensity * glow;

    // Static film grain
    float n = hash(gl_FragCoord.xy);
    color += (n - 0.5) * uGrainIntensity;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Shader compile error: " + info);
    }
    return shader;
  }

  const vertShader = compileShader(gl.VERTEX_SHADER, vertSrc);
  const fragShader = compileShader(gl.FRAGMENT_SHADER, fragSrc);

  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // Fullscreen triangle (covers viewport without a quad's extra vertices)
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Uniform locations
  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    baseColor: gl.getUniformLocation(program, "uBaseColor"),
    highlightColor: gl.getUniformLocation(program, "uHighlightColor"),

    lobeBasePos: gl.getUniformLocation(program, "uLobeBasePos[0]"),
    lobeDriftFreq: gl.getUniformLocation(program, "uLobeDriftFreq[0]"),
    lobePhase: gl.getUniformLocation(program, "uLobePhase[0]"),
    lobeDriftAmp: gl.getUniformLocation(program, "uLobeDriftAmp[0]"),
    lobeRadius: gl.getUniformLocation(program, "uLobeRadius[0]"),
    lobeFormFreq: gl.getUniformLocation(program, "uLobeFormFreq[0]"),
    lobeFormPhase: gl.getUniformLocation(program, "uLobeFormPhase[0]"),
    lobeFormMin: gl.getUniformLocation(program, "uLobeFormMin"),
    lobeCount: gl.getUniformLocation(program, "uLobeCount"),
    loadFadeIn: gl.getUniformLocation(program, "uLoadFadeIn"),

    rippleCenter: gl.getUniformLocation(program, "uRippleCenter"),
    rippleSpacing: gl.getUniformLocation(program, "uRippleSpacing"),
    rippleShift: gl.getUniformLocation(program, "uRippleShift"),
    rippleCycleCount: gl.getUniformLocation(program, "uRippleCycleCount"),
    rippleEnabled: gl.getUniformLocation(program, "uRippleEnabled"),

    mousePos: gl.getUniformLocation(program, "uMousePos"),
    mouseInfluence: gl.getUniformLocation(program, "uMouseInfluence"),
    mouseRadius: gl.getUniformLocation(program, "uMouseRadius"),
    mouseGlowRadius: gl.getUniformLocation(program, "uMouseGlowRadius"),
    mousePushStrength: gl.getUniformLocation(program, "uMousePushStrength"),
    mouseGlowBoost: gl.getUniformLocation(program, "uMouseGlowBoost"),
    mouseVelocityDir: gl.getUniformLocation(program, "uMouseVelocityDir"),
    mouseTurbDir: gl.getUniformLocation(program, "uMouseTurbDir"),
    mouseVelocityFactor: gl.getUniformLocation(program, "uMouseVelocityFactor"),
    mouseTurbVelocityFactor: gl.getUniformLocation(
      program,
      "uMouseTurbVelocityFactor",
    ),

    creaseAngle: gl.getUniformLocation(program, "uCreaseAngle"),
    creaseOffset: gl.getUniformLocation(program, "uCreaseOffset"),
    creaseWidth: gl.getUniformLocation(program, "uCreaseWidth"),
    creaseStrength: gl.getUniformLocation(program, "uCreaseStrength"),
    vignetteStart: gl.getUniformLocation(program, "uVignetteStart"),
    vignetteEnd: gl.getUniformLocation(program, "uVignetteEnd"),
    vignetteStrength: gl.getUniformLocation(program, "uVignetteStrength"),
    grainIntensity: gl.getUniformLocation(program, "uGrainIntensity"),

    turbSpeed: gl.getUniformLocation(program, "uTurbSpeed"),
    turbScale: gl.getUniformLocation(program, "uTurbScale"),
    turbIntensity: gl.getUniformLocation(program, "uTurbIntensity"),
    turbCurlAmount: gl.getUniformLocation(program, "uTurbCurlAmount"),
    turbCurlScale: gl.getUniformLocation(program, "uTurbCurlScale"),
    mouseTurbRadius: gl.getUniformLocation(program, "uMouseTurbRadius"),
    mouseTurbPushStrength: gl.getUniformLocation(
      program,
      "uMouseTurbPushStrength",
    ),
    mouseTurbTrailStrength: gl.getUniformLocation(
      program,
      "uMouseTurbTrailStrength",
    ),
    mouseTurbTrailLength: gl.getUniformLocation(
      program,
      "uMouseTurbTrailLength",
    ),
    mouseTurbEdgeNoise: gl.getUniformLocation(program, "uMouseTurbEdgeNoise"),
    mouseTurbSwap: gl.getUniformLocation(program, "uMouseTurbSwap"),
    debugTurbView: gl.getUniformLocation(program, "uDebugTurbView"),
  };

  // ── Randomized, per-lobe motion parameters (generated once at init) ──────
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function generateLobeParams() {
    const basePos = new Float32Array(MAX_LOBES * 2);
    const driftFreq = new Float32Array(MAX_LOBES * 2);
    const phase = new Float32Array(MAX_LOBES * 2);
    const driftAmp = new Float32Array(MAX_LOBES);
    const radius = new Float32Array(MAX_LOBES);
    const formFreq = new Float32Array(MAX_LOBES);
    const formPhase = new Float32Array(MAX_LOBES);

    for (let i = 0; i < MAX_LOBES; i++) {
      // Spread base positions loosely around center so they overlap and
      // hand off to one another as they pulse in/out.
      basePos[i * 2] = rand(-0.32, 0.32);
      basePos[i * 2 + 1] = rand(-0.28, 0.28);

      // Distinct, non-resonant drift frequencies per axis -> organic wander
      // instead of a repeating loop.
      driftFreq[i * 2] = rand(0.08, 0.22);
      driftFreq[i * 2 + 1] = rand(0.08, 0.22);

      phase[i * 2] = rand(0, Math.PI * 2);
      phase[i * 2 + 1] = rand(0, Math.PI * 2);

      driftAmp[i] = CFG.lobes.driftRadius * rand(0.7, 1.3);
      radius[i] = CFG.lobes.radiusBase + rand(-1, 1) * CFG.lobes.radiusVariance;

      // Slow, independent formation cycle per lobe so they don't pulse in sync
      formFreq[i] = rand(0.05, 0.14);
      formPhase[i] = rand(0, Math.PI * 2);
    }

    return { basePos, driftFreq, phase, driftAmp, radius, formFreq, formPhase };
  }

  const lobeParams = generateLobeParams();

  // ── Theme handling ──────────────────────────────────────────────────────
  const watchThemeToggle = canvas.hasAttribute(CFG.theme.toggleAttribute);
  const watchSectionTheme = canvas.hasAttribute(CFG.theme.sectionAttribute);

  function getActiveThemeName() {
    if (!watchThemeToggle) return "dark";
    const docTheme = document.documentElement.getAttribute("data-theme");
    return docTheme === "light" ? "light" : "dark";
  }

  // ── Section-based scroll theming ────────────────────────────────────────
  // Reads every element with data-canvas-theme, in document order. Each
  // section has a single flip threshold (data-canvas-start, default 0.5)
  // against the same progress metric as before: 0 when the section's top
  // is at the viewport's bottom, 1 when it's reached the viewport's top.
  // The active theme is whichever section, last in document order, has
  // already crossed its threshold — so scrolling back up past it reverts
  // to whatever came before, same as scrolling forward advances it.
  let themeSections = [];

  function parseThreshold(attrValue) {
    const val = parseFloat(attrValue);
    return isNaN(val) ? 0.5 : val;
  }

  function collectThemeSections() {
    const elements = document.querySelectorAll(
      `[${CFG.theme.sectionThemeAttr}]`,
    );
    themeSections = Array.from(elements).map((el) => ({
      el,
      themeName:
        el.getAttribute(CFG.theme.sectionThemeAttr) === "light"
          ? "light"
          : "dark",
      threshold: parseThreshold(el.getAttribute(CFG.theme.sectionStartAttr)),
    }));
  }

  function computeSectionTargetTheme() {
    const viewportHeight = window.innerHeight;
    let active = "dark"; // resting default before any section has triggered
    for (const section of themeSections) {
      const rect = section.el.getBoundingClientRect();
      const rawProgress = Math.min(
        Math.max((viewportHeight - rect.top) / viewportHeight, 0),
        1,
      );
      if (rawProgress >= section.threshold) active = section.themeName;
    }
    return active;
  }

  if (watchSectionTheme) collectThemeSections();

  // Crossfades smoothly between palettes instead of swapping instantly.
  // currentColor holds the live, eased values; targetThemeName is just a
  // cheap cached label updated by whichever mode is active (observer for
  // the toggle, scroll listener for sections) — never a per-frame DOM read.
  let targetThemeName = watchSectionTheme
    ? computeSectionTargetTheme()
    : getActiveThemeName();
  const initialPalette = CFG.colors[targetThemeName];
  const currentColor = {
    base: initialPalette.baseColor.slice(),
    highlight: initialPalette.highlightColor.slice(),
  };

  function updateThemeColors() {
    const target = CFG.colors[targetThemeName];
    let maxDelta = 0;
    for (let i = 0; i < 3; i++) {
      const db = target.baseColor[i] - currentColor.base[i];
      const dh = target.highlightColor[i] - currentColor.highlight[i];
      maxDelta = Math.max(maxDelta, Math.abs(db), Math.abs(dh));
      currentColor.base[i] += db * CFG.theme.transitionSpeed;
      currentColor.highlight[i] += dh * CFG.theme.transitionSpeed;
    }
    // Once converged, stop re-uploading identical values every frame.
    // Resumes automatically the moment targetThemeName changes again.
    if (maxDelta < 0.0008) return;
    gl.uniform3fv(uniforms.baseColor, currentColor.base);
    gl.uniform3fv(uniforms.highlightColor, currentColor.highlight);
  }

  // Scroll/resize-driven, rAF-throttled — only recomputes when the page
  // actually moves, not every animation frame like the old scrub version.
  let sectionThemeUpdateScheduled = false;
  function scheduleSectionThemeUpdate() {
    if (sectionThemeUpdateScheduled) return;
    sectionThemeUpdateScheduled = true;
    requestAnimationFrame(() => {
      targetThemeName = computeSectionTargetTheme();
      sectionThemeUpdateScheduled = false;
    });
  }

  if (watchSectionTheme) {
    window.addEventListener("scroll", scheduleSectionThemeUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleSectionThemeUpdate);
  }

  function setStaticUniforms() {
    gl.uniform3fv(uniforms.baseColor, currentColor.base);
    gl.uniform3fv(uniforms.highlightColor, currentColor.highlight);

    gl.uniform2fv(uniforms.lobeBasePos, lobeParams.basePos);
    gl.uniform2fv(uniforms.lobeDriftFreq, lobeParams.driftFreq);
    gl.uniform2fv(uniforms.lobePhase, lobeParams.phase);
    gl.uniform1fv(uniforms.lobeDriftAmp, lobeParams.driftAmp);
    gl.uniform1fv(uniforms.lobeRadius, lobeParams.radius);
    gl.uniform1fv(uniforms.lobeFormFreq, lobeParams.formFreq);
    gl.uniform1fv(uniforms.lobeFormPhase, lobeParams.formPhase);
    gl.uniform1f(uniforms.lobeFormMin, CFG.lobes.formMin);
    gl.uniform1i(uniforms.lobeCount, Math.min(CFG.lobes.count, MAX_LOBES));

    gl.uniform2f(uniforms.rippleCenter, CFG.ripple.centerX, CFG.ripple.centerY);
    gl.uniform1f(uniforms.rippleSpacing, CFG.ripple.spacing);
    gl.uniform1f(uniforms.rippleShift, CFG.ripple.shiftAmount);
    gl.uniform1f(uniforms.rippleCycleCount, CFG.ripple.cycleCount);
    gl.uniform1f(uniforms.rippleEnabled, CFG.ripple.enabled ? 1.0 : 0.0);

    gl.uniform1f(uniforms.mouseRadius, CFG.mouse.radius);
    gl.uniform1f(uniforms.mouseGlowRadius, CFG.mouse.glowRadius);
    gl.uniform1f(uniforms.mousePushStrength, CFG.mouse.pushStrength);
    gl.uniform1f(uniforms.mouseGlowBoost, CFG.mouse.glowBoost);

    gl.uniform1f(uniforms.creaseAngle, CFG.creaseAngle);
    gl.uniform1f(uniforms.creaseOffset, CFG.creaseOffset);
    gl.uniform1f(uniforms.creaseWidth, CFG.creaseWidth);
    gl.uniform1f(uniforms.creaseStrength, CFG.creaseStrength);
    gl.uniform1f(uniforms.vignetteStart, CFG.vignetteStart);
    gl.uniform1f(uniforms.vignetteEnd, CFG.vignetteEnd);
    gl.uniform1f(uniforms.vignetteStrength, CFG.vignetteStrength);
    gl.uniform1f(uniforms.grainIntensity, CFG.grainIntensity);

    gl.uniform1f(uniforms.turbSpeed, CFG.turbulence.speed);
    gl.uniform1f(uniforms.turbScale, CFG.turbulence.scale);
    gl.uniform1f(uniforms.turbIntensity, CFG.turbulence.intensity);
    gl.uniform1f(uniforms.turbCurlAmount, CFG.turbulence.curlAmount);
    gl.uniform1f(uniforms.turbCurlScale, CFG.turbulence.curlScale);
    gl.uniform1f(uniforms.mouseTurbRadius, CFG.mouse.turbRadius);
    gl.uniform1f(uniforms.mouseTurbPushStrength, CFG.mouse.turbPushStrength);
    gl.uniform1f(uniforms.mouseTurbTrailStrength, CFG.mouse.turbTrailStrength);
    gl.uniform1f(uniforms.mouseTurbTrailLength, CFG.mouse.turbTrailLength);
    gl.uniform1f(uniforms.mouseTurbEdgeNoise, CFG.mouse.turbEdgeNoise);
    gl.uniform1f(
      uniforms.mouseTurbSwap,
      CFG.mouse.turbSwapPushPull ? 1.0 : 0.0,
    );
    gl.uniform1f(uniforms.debugTurbView, CFG.debug.turbulenceView ? 1.0 : 0.0);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  setStaticUniforms();
  resize();

  if (watchThemeToggle) {
    const themeObserver = new MutationObserver(() => {
      targetThemeName = getActiveThemeName();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resize();
      canvasRect = canvas.getBoundingClientRect();
    }, 100);
  });

  // ── Mouse tracking ──────────────────────────────────────────────────────
  // Position and influence are both eased every frame, never read raw —
  // this avoids stale-velocity artifacts and gives a smooth "push" feel.
  const targetMouse = { x: 0, y: 0 };
  const smoothMouse = { x: 0, y: 0 };
  let mouseActive = false;
  let mouseInfluence = 0;
  let wasActive = false;
  const prevMouse = { x: 0, y: 0 };
  const velocityDir = { x: 0, y: 1 };
  const smoothDirection = { x: 0, y: 1 };
  let smoothVelocityMag = 0; // lobes
  let smoothVelocityMagTurb = 0; // turbulence — independent track

  // Cached instead of read on every pointermove — getBoundingClientRect() is
  // a layout read, and doing that on every mouse event (rather than only
  // when the canvas's actual position could have changed) risks forced
  // reflow on busy pages. Refreshed on resize, where it's already cheap.
  let canvasRect = canvas.getBoundingClientRect();

  function updateTargetMouse(clientX, clientY) {
    const px = (clientX - canvasRect.left) * (canvas.width / canvasRect.width);
    const pyFromTop =
      (clientY - canvasRect.top) * (canvas.height / canvasRect.height);
    const pyGl = canvas.height - pyFromTop; // flip to match gl_FragCoord's bottom-left origin
    const minDim = Math.min(canvas.width, canvas.height);

    targetMouse.x = (px - 0.5 * canvas.width) / minDim;
    targetMouse.y = (pyGl - 0.5 * canvas.height) / minDim;
  }

  window.addEventListener("pointermove", (e) => {
    updateTargetMouse(e.clientX, e.clientY);
    mouseActive = true;
  });
  window.addEventListener("pointerout", (e) => {
    if (!e.relatedTarget) mouseActive = false; // cursor left the document entirely
  });

  let startTime = performance.now();
  let lastFrameNow = startTime;
  let loadFadeInDone = false;

  function frame(now) {
    const elapsedSeconds = (now - startTime) / 1000;
    const dt = Math.min(Math.max((now - lastFrameNow) / 1000, 0.0001), 0.1);
    lastFrameNow = now;

    // Smoothstep-eased fade-in, tied to real time so it's unaffected by
    // motionSpeed. Skips redundant uniform uploads once fully faded in.
    let loadFadeIn = 1.0;
    if (!loadFadeInDone) {
      const fadeT = Math.min(elapsedSeconds / CFG.loadFadeInDuration, 1);
      loadFadeIn = fadeT * fadeT * (3 - 2 * fadeT);
      gl.uniform1f(uniforms.loadFadeIn, loadFadeIn);
      if (fadeT >= 1) loadFadeInDone = true;
    }

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsedSeconds * CFG.motionSpeed);

    mouseInfluence +=
      ((mouseActive ? 1 : 0) - mouseInfluence) * CFG.mouse.influenceSmoothing;

    // Cursor just entered — snap instead of easing in, so we don't compute
    // a fake velocity burst from wherever the cursor last happened to be.
    if (mouseActive && !wasActive) {
      smoothMouse.x = targetMouse.x;
      smoothMouse.y = targetMouse.y;
      prevMouse.x = targetMouse.x;
      prevMouse.y = targetMouse.y;
      smoothVelocityMag = 0;
      smoothVelocityMagTurb = 0;
    }
    wasActive = mouseActive;

    smoothMouse.x +=
      (targetMouse.x - smoothMouse.x) * CFG.mouse.positionSmoothing;
    smoothMouse.y +=
      (targetMouse.y - smoothMouse.y) * CFG.mouse.positionSmoothing;

    const dx = smoothMouse.x - prevMouse.x;
    const dy = smoothMouse.y - prevMouse.y;
    const frameSpeed = Math.sqrt(dx * dx + dy * dy);
    prevMouse.x = smoothMouse.x;
    prevMouse.y = smoothMouse.y;

    if (frameSpeed > 0.00001) {
      velocityDir.x = dx / frameSpeed;
      velocityDir.y = dy / frameSpeed;
    }

    // Ease the direction itself, separate from magnitude — this is what
    // gives the grain "momentum" on a sharp reversal instead of an instant
    // 180° flip. Lerping two unit vectors shrinks the result, so it needs
    // re-normalizing afterward to stay a proper direction.
    // Eased separately from the raw direction below — only the turbulence
    // reads this. Lobes use the raw, instant direction, unaffected by this
    // "momentum" smoothing.
    smoothDirection.x +=
      (velocityDir.x - smoothDirection.x) * CFG.mouse.turbDirectionSmoothing;
    smoothDirection.y +=
      (velocityDir.y - smoothDirection.y) * CFG.mouse.turbDirectionSmoothing;
    const dirLen =
      Math.sqrt(
        smoothDirection.x * smoothDirection.x +
          smoothDirection.y * smoothDirection.y,
      ) || 1;
    const normDirX = smoothDirection.x / dirLen;
    const normDirY = smoothDirection.y / dirLen;

    const rawSpeedPerSec = frameSpeed / dt;

    const speedRising = rawSpeedPerSec > smoothVelocityMag;
    const speedSmoothingRate = speedRising
      ? CFG.mouse.lobeVelocitySmoothing
      : CFG.mouse.lobeVelocityRestoreSmoothing;
    smoothVelocityMag +=
      (rawSpeedPerSec - smoothVelocityMag) * speedSmoothingRate;
    const velocityFactor = Math.min(
      smoothVelocityMag / CFG.mouse.lobeVelocityReference,
      1.0,
    );

    const speedRisingTurb = rawSpeedPerSec > smoothVelocityMagTurb;
    const speedSmoothingRateTurb = speedRisingTurb
      ? CFG.mouse.velocitySmoothing
      : CFG.mouse.velocityRestoreSmoothing;
    smoothVelocityMagTurb +=
      (rawSpeedPerSec - smoothVelocityMagTurb) * speedSmoothingRateTurb;
    const turbVelocityFactor = CFG.mouse.turbMouseEnabled
      ? Math.min(smoothVelocityMagTurb / CFG.mouse.velocityReference, 1.0)
      : 0.0;

    gl.uniform2f(uniforms.mousePos, smoothMouse.x, smoothMouse.y);
    gl.uniform1f(uniforms.mouseInfluence, mouseInfluence);
    gl.uniform2f(uniforms.mouseVelocityDir, velocityDir.x, velocityDir.y);
    gl.uniform2f(uniforms.mouseTurbDir, normDirX, normDirY);
    gl.uniform1f(uniforms.mouseVelocityFactor, velocityFactor);
    gl.uniform1f(uniforms.mouseTurbVelocityFactor, turbVelocityFactor);

    if (watchThemeToggle || watchSectionTheme) updateThemeColors();

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

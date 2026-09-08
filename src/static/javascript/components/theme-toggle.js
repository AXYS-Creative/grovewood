// const storageKey = "theme-preference";
// const radios = document.querySelectorAll('input[name="theme"]');

// const getSystemPreference = () =>
//   window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

// const applyTheme = (theme) => {
//   if (theme === "system") {
//     theme = getSystemPreference();
//   }
//   document.documentElement.setAttribute("data-theme", theme);
// };

// const setTheme = (theme) => {
//   localStorage.setItem(storageKey, theme);
//   applyTheme(theme);
// };

// // ---- Initialization ----
// const saved = localStorage.getItem(storageKey) || "system";
// applyTheme(saved);

// // Sync radio state to saved value
// radios.forEach((radio) => {
//   radio.checked = radio.value === saved;
// });

// // ---- Listeners ----
// radios.forEach((radio) => {
//   radio.addEventListener("click", (e) => {
//     // force checked on click
//     radios.forEach((r) => (r.checked = false));
//     e.target.checked = true;

//     setTheme(e.target.value);
//   });

//   // also handle change (keyboard/tabbing etc.)
//   radio.addEventListener("change", (e) => {
//     if (e.target.checked) {
//       setTheme(e.target.value);
//     }
//   });
// });

// // Listen for system preference changes if "system" is selected
// window
//   .matchMedia("(prefers-color-scheme: dark)")
//   .addEventListener("change", (e) => {
//     if (localStorage.getItem(storageKey) === "system") {
//       applyTheme(e.matches ? "dark" : "light");
//     }
//   });

// // ---- Theme-image swapping ----
// const swapThemeImages = () => {
//   const theme = document.documentElement.getAttribute("data-theme");
//   document.querySelectorAll("img.theme-img").forEach((img) => {
//     const newSrc = img.dataset[theme];
//     if (newSrc && img.src !== newSrc) {
//       img.src = newSrc;
//     }
//   });
// };

// swapThemeImages();

// const observer = new MutationObserver(swapThemeImages);
// observer.observe(document.documentElement, {
//   attributes: true,
//   attributeFilter: ["data-theme"],
// });

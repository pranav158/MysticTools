// Apply the saved light/dark choice before first paint (no inline scripts: the CSP forbids them).
try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch { /* storage blocked: follow the system theme */ }

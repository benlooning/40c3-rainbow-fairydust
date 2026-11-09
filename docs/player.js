"use strict";
const film = document.querySelector("#film");
const screen = document.querySelector("#screen");
const description = document.querySelector("#format-description");
const error = document.querySelector("#playback-error");
const buttons = document.querySelectorAll("[data-format]");
const formats = {
  landscape: { file: "16x9", poster: "landscape.png", label: "Fairydust flying right · 1920 × 1080" },
  portrait: { file: "9x16", poster: "portrait.png", label: "Upright Fairydust flying up · 1080 × 1920" }
};
let selected = "landscape";
let pendingSeek = 0;
let resume = false;
function selectFormat(name) {
  if (!formats[name] || selected === name) return;
  pendingSeek = film.currentTime || 0;
  resume = !film.paused && !film.ended;
  film.pause();
  selected = name;
  const format = formats[name];
  error.hidden = true;
  screen.classList.toggle("portrait", name === "portrait");
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.format === name));
  description.textContent = format.label;
  film.setAttribute("aria-label", `Model Citizens — ${format.label}, with an instrumental soundtrack`);
  film.poster = format.poster;
  film.src = `media/40c3-fairydust-${format.file}-sound.mp4`;
  film.load();
  const url = new URL(location.href);
  url.searchParams.set("format", name);
  history.replaceState(null, "", url);
}
film.addEventListener("loadedmetadata", () => {
  if (pendingSeek && Number.isFinite(film.duration)) film.currentTime = Math.min(pendingSeek, Math.max(0, film.duration - .1));
  pendingSeek = 0;
  if (resume) { resume = false; film.play().catch(() => {}); }
});
film.addEventListener("error", () => { error.hidden = false; });
for (const button of buttons) button.addEventListener("click", () => selectFormat(button.dataset.format));
selectFormat(new URLSearchParams(location.search).get("format"));

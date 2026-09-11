/* SplitVideo — client-side splitter
   Everything runs in the browser via ffmpeg.wasm. No file is ever
   uploaded to a server. This is why file size is capped: browser
   memory, not bandwidth, is the real ceiling for this approach.
*/

const MAX_FILE_MB = 500; // hard cap — see README for why
const { FFmpeg } = FFmpegWASM;
const { fetchFile, toBlobURL } = FFmpegUtil;

let ffmpeg = null;
let ffmpegLoaded = false;
let selectedFile = null;
let splitMode = "duration"; // 'duration' | 'parts'
let selectedSeconds = 60;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const controls = document.getElementById("controls");
const fileMeta = document.getElementById("fileMeta");
const resetBtn = document.getElementById("resetBtn");
const modeButtons = document.querySelectorAll(".split-mode-toggle button");
const durationFields = document.getElementById("durationFields");
const partsFields = document.getElementById("partsFields");
const presetChips = document.querySelectorAll(".preset-chips button");
const customSeconds = document.getElementById("customSeconds");
const partsCount = document.getElementById("partsCount");
const splitBtn = document.getElementById("splitBtn");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const clipList = document.getElementById("clipList");
const errorBox = document.getElementById("errorBox");

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("active");
}
function clearError() {
  errorBox.classList.remove("active");
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
  clearError();
  if (!file.type.startsWith("video/")) {
    showError("That doesn't look like a video file. Try an MP4, MOV, or WebM.");
    return;
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_MB) {
    showError(
      `This file is ${sizeMB.toFixed(0)}MB. Browser-based splitting works reliably up to ${MAX_FILE_MB}MB — larger files can crash the tab. We're working on support for bigger files.`
    );
    return;
  }
  selectedFile = file;
  fileMeta.innerHTML = `<span>Selected: <strong>${file.name}</strong> (${sizeMB.toFixed(1)}MB)</span>`;
  controls.classList.add("active");
  clipList.classList.remove("active");
  clipList.innerHTML = "";
  progressWrap.classList.remove("active");
}

resetBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  controls.classList.remove("active");
  clipList.classList.remove("active");
  progressWrap.classList.remove("active");
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    splitMode = btn.dataset.mode;
    durationFields.style.display = splitMode === "duration" ? "block" : "none";
    partsFields.style.display = splitMode === "parts" ? "block" : "none";
  });
});

presetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    presetChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    selectedSeconds = parseInt(chip.dataset.seconds, 10);
    customSeconds.value = "";
  });
});
customSeconds.addEventListener("input", () => {
  if (customSeconds.value) {
    presetChips.forEach((c) => c.classList.remove("active"));
    selectedSeconds = parseInt(customSeconds.value, 10);
  }
});

async function ensureFFmpeg() {
  if (ffmpegLoaded) return;
  progressLabel.querySelector(".stage").textContent = "Loading video engine…";
  progressWrap.classList.add("active");
  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(100, Math.round(progress * 100));
    progressFill.style.width = pct + "%";
    progressLabel.querySelector(".pct").textContent = pct + "%";
  });
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegLoaded = true;
}

async function getDuration(inputName) {
  let duration = 0;
  const onLog = ({ message }) => {
    const match = message.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (match) {
      duration = (+match[1]) * 3600 + (+match[2]) * 60 + parseFloat(match[3]);
    }
  };
  ffmpeg.on("log", onLog);
  try {
    await ffmpeg.exec(["-i", inputName]);
  } catch (e) {
    // ffmpeg -i with no output intentionally "fails" — duration is still parsed from logs
  }
  ffmpeg.off("log", onLog);
  return duration;
}

splitBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  clearError();
  splitBtn.disabled = true;
  clipList.innerHTML = "";
  clipList.classList.remove("active");

  try {
    await ensureFFmpeg();

    const inputName = "input" + (selectedFile.name.match(/\.\w+$/)?.[0] || ".mp4");
    progressLabel.querySelector(".stage").textContent = "Reading your video…";
    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

    progressLabel.querySelector(".stage").textContent = "Checking video length…";
    const totalDuration = await getDuration(inputName);
    if (!totalDuration) {
      showError("Couldn't read this video's length. Try a different file or format (MP4 works best).");
      splitBtn.disabled = false;
      return;
    }

    let clipSeconds;
    if (splitMode === "duration") {
      clipSeconds = selectedSeconds || 60;
    } else {
      const parts = Math.max(2, parseInt(partsCount.value, 10) || 2);
      clipSeconds = totalDuration / parts;
    }

    const numClips = Math.ceil(totalDuration / clipSeconds);
    clipList.classList.add("active");

    for (let i = 0; i < numClips; i++) {
      const start = i * clipSeconds;
      const outName = `clip_${i + 1}.mp4`;
      progressLabel.querySelector(".stage").textContent = `Cutting clip ${i + 1} of ${numClips}…`;

      const row = document.createElement("div");
      row.className = "clip-row";
      row.innerHTML = `<span>Clip ${i + 1}</span><span class="clip-status">processing…</span>`;
      clipList.appendChild(row);

      await ffmpeg.exec([
        "-ss", String(start),
        "-i", inputName,
        "-t", String(clipSeconds),
        "-c", "copy",
        outName,
      ]);

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      row.innerHTML = `<span>Clip ${i + 1}</span><a class="dl" href="${url}" download="${selectedFile.name.replace(/\.\w+$/, "")}_clip${i + 1}.mp4">Download ↓</a>`;

      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedFile.name.replace(/\.\w+$/, "")}_clip${i + 1}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await ffmpeg.deleteFile(outName);
    }

    progressLabel.querySelector(".stage").textContent = "Done — all clips downloaded.";
    progressFill.style.width = "100%";
  } catch (err) {
    console.error(err);
    showError("Something went wrong while splitting this video. Try a shorter clip length or a different file.");
  } finally {
    splitBtn.disabled = false;
  }
});

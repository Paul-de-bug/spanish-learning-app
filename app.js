const maxQuestions = 10;
const accuracyTarget = 80;
const accuracyWindows = [100, 200, 500, 1000];
const xpPerLevel = 105;
const quizXp = 5;
const quizTargetXp = 15;
const streakTarget = 5;
const streakXp = 5;
const xpSegmentSize = 5;
const xpSegmentsPerLevel = xpPerLevel / xpSegmentSize;
const lessonIndexFile = "./data/lesson-index.json";
const storageKey = "spanish-pills-mobile-results";
const savedWordsKey = "spanish-pills-saved-words";
const xpStorageKey = "spanish-pills-total-xp";

const els = {
  lessonTitle: document.querySelector("#lessonTitle"),
  lessonSelect: document.querySelector("#lessonSelect"),
  lessonDescription: document.querySelector("#lessonDescription"),
  openMenuButton: document.querySelector("#openMenuButton"),
  closeMenuButton: document.querySelector("#closeMenuButton"),
  mobileMenu: document.querySelector("#mobileMenu"),
  menuOverlay: document.querySelector("#menuOverlay"),
  shuffleButton: document.querySelector("#shuffleButton"),
  resetButton: document.querySelector("#resetButton"),
  progressBox: document.querySelector("#progressBox"),
  progressPills: document.querySelector("#progressPills"),
  accuracyBox: document.querySelector("#accuracyBox"),
  accuracyText: document.querySelector("#accuracyText"),
  xpPanel: document.querySelector("#xpPanel"),
  xpLevelText: document.querySelector("#xpLevelText"),
  xpText: document.querySelector("#xpText"),
  xpTrack: document.querySelector(".xp-track"),
  xpSegments: document.querySelector("#xpSegments"),
  questionCounter: document.querySelector("#questionCounter"),
  promptText: document.querySelector("#promptText"),
  answerLine: document.querySelector("#answerLine"),
  chunkBank: document.querySelector("#chunkBank"),
  undoButton: document.querySelector("#undoButton"),
  skipButton: document.querySelector("#skipButton"),
  submitButton: document.querySelector("#submitButton"),
  feedback: document.querySelector("#feedback"),
  feedbackTitle: document.querySelector("#feedbackTitle"),
  correctAnswer: document.querySelector("#correctAnswer"),
  englishAnswer: document.querySelector("#englishAnswer"),
  attemptAnswer: document.querySelector("#attemptAnswer"),
  saveChunkList: document.querySelector("#saveChunkList"),
  savedCount: document.querySelector("#savedCount"),
  saveFrontInput: document.querySelector("#saveFrontInput"),
  saveBackInput: document.querySelector("#saveBackInput"),
  saveManualButton: document.querySelector("#saveManualButton"),
  savedPreview: document.querySelector("#savedPreview"),
  historyBars: document.querySelector("#historyBars"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  clearSavedButton: document.querySelector("#clearSavedButton")
};

let lessons = [];
let exercises = [];
let session = [];
let currentIndex = 0;
let selected = [];
let selectedIndexes = new Set();
let shuffledChunkOrder = [];
let results = loadResults();
let sessionResults = [];
let savedWords = loadSavedWords();
let totalXp = loadXp();
let sessionAwarded = false;
let currentStreak = 0;
let xpAnimationQueue = Promise.resolve();
let awaitingNext = false;
let audioContext;

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function loadResults() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? [];
  } catch {
    return [];
  }
}

function loadSavedWords() {
  try {
    return JSON.parse(localStorage.getItem(savedWordsKey)) ?? [];
  } catch {
    return [];
  }
}

function loadXp() {
  const parsed = Number(localStorage.getItem(xpStorageKey));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function saveResults() {
  localStorage.setItem(storageKey, JSON.stringify(results));
}

function saveXp() {
  localStorage.setItem(xpStorageKey, String(totalXp));
}

function saveSavedWords() {
  localStorage.setItem(savedWordsKey, JSON.stringify(savedWords));
}

function shuffle(items) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function mixRgb(left, right, amount) {
  return left.map((value, index) => Math.round(value + (right[index] - value) * amount));
}

function accuracyRgb(accuracy) {
  const red = [223, 45, 45];
  const orange = [242, 132, 31];
  const yellow = [244, 211, 52];
  const green = [34, 197, 94];

  if (accuracy >= 75) return mixRgb(yellow, green, (accuracy - 75) / 25);
  if (accuracy >= 50) return mixRgb(orange, yellow, (accuracy - 50) / 25);
  return mixRgb(red, orange, accuracy / 50);
}

function accuracySummary(items) {
  const correct = items.filter((result) => result.correct).length;
  return items.length ? Math.round((correct / items.length) * 100) : null;
}

function xpState(xpValue = totalXp, holdBoundary = false) {
  if (holdBoundary && xpValue > 0 && xpValue % xpPerLevel === 0) {
    return {
      level: xpValue / xpPerLevel,
      levelXp: xpPerLevel
    };
  }

  return {
    level: Math.floor(xpValue / xpPerLevel) + 1,
    levelXp: xpValue % xpPerLevel
  };
}

function xpSegmentFor(levelXp) {
  if (levelXp === 0) return null;
  return Math.ceil(levelXp / xpSegmentSize) - 1;
}

function sample(items) {
  if (items.length <= maxQuestions) return shuffle(items);
  return shuffle(items).slice(0, maxQuestions);
}

function currentLesson() {
  return lessons.find((lesson) => lesson.id === els.lessonSelect.value) ?? lessons[0];
}

function currentExercise() {
  return session[currentIndex];
}

function currentLessonNumber() {
  return Math.max(lessons.findIndex((lesson) => lesson.id === currentLesson()?.id), 0) + 1;
}

function shortLessonName(lesson) {
  return (lesson?.name ?? "Lesson")
    .replace(/^\d+\.\s*/, "")
    .split(" - ")[0]
    .trim();
}

function currentLessonTitle() {
  const lesson = currentLesson();
  return `${currentLessonNumber()}. ${shortLessonName(lesson)}`;
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLocaleLowerCase("es-ES") + text.slice(1) : "";
}

function capitaliseFirst(text) {
  return text ? text.charAt(0).toLocaleUpperCase("es-ES") + text.slice(1) : "";
}

function polishedAnswer(answer) {
  return capitaliseFirst(answer.join(" "));
}

function promptText(exercise) {
  return exercise.prompt_es ?? exercise.prompt ?? "";
}

function answerEnglish(exercise) {
  return exercise.answer_en ?? exercise.translation_en ?? "";
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function playCorrectSound() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  master.connect(audioContext.destination);

  [880, 1320].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const toneGain = audioContext.createGain();
    const start = now + index * 0.07;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.exponentialRampToValueAtTime(1, start + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

    oscillator.connect(toneGain);
    toneGain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  });
}

function itemKey(front, lessonId = "") {
  return `${front.trim().toLocaleLowerCase("es-ES")}::${lessonId}`;
}

function currentTags(exercise, lesson) {
  return [
    "spanish",
    lesson?.id,
    exercise?.level,
    ...(exercise?.patterns ?? [])
  ].filter(Boolean);
}

function savedWordExists(front, lessonId = "") {
  const key = itemKey(front, lessonId);
  return savedWords.some((item) => itemKey(item.front, item.lesson_id ?? "") === key);
}

function addSavedWord({ front, back = "", example = "", tags = [], lesson, exercise, source = "manual" }) {
  const cleanFront = front.trim();
  if (!cleanFront) return false;

  const lessonId = lesson?.id ?? "";
  if (savedWordExists(cleanFront, lessonId)) return false;

  savedWords.unshift({
    id: `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: new Date().toISOString(),
    front: cleanFront,
    back: back.trim(),
    example: example.trim(),
    tags: [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))],
    lesson_id: lessonId,
    lesson_name: lesson?.name ?? "",
    exercise_id: exercise?.id ?? "",
    source
  });
  saveSavedWords();
  renderSavedWords();
  return true;
}

function populateLessons() {
  els.lessonSelect.innerHTML = "";
  lessons.forEach((lesson) => {
    const option = document.createElement("option");
    option.value = lesson.id;
    option.textContent = lesson.name;
    els.lessonSelect.append(option);
  });
}

async function loadLesson() {
  const lesson = currentLesson();
  els.lessonDescription.textContent = lesson.description ?? "";
  exercises = await loadJson(lesson.file);
  startSession();
  closeMenu();
}

function startSession() {
  session = sample(exercises);
  sessionResults = [];
  sessionAwarded = false;
  currentStreak = 0;
  currentIndex = 0;
  selected = [];
  selectedIndexes = new Set();
  renderExercise();
}

function shuffleLesson() {
  startSession();
  closeMenu();
}

function renderStats() {
  const accuracy = accuracySummary(sessionResults) ?? 0;
  const accuracyColor = accuracyRgb(accuracy).join(", ");

  els.accuracyText.textContent = `${accuracy}%`;
  els.accuracyBox.style.setProperty("--accuracy-value", `${accuracy}%`);
  els.accuracyBox.style.setProperty("--accuracy-color", accuracyColor);
  els.accuracyBox.classList.toggle("target-met", accuracy >= accuracyTarget);
  renderProgressPills();
  renderXp();
  renderHistoryBars();
}

function renderXp(xpValue = totalXp, flashSegment = null, holdBoundary = false) {
  const { level, levelXp } = xpState(xpValue, holdBoundary);
  const activeSegments = Math.floor(levelXp / xpSegmentSize);

  els.xpLevelText.textContent = `Level ${level}`;
  els.xpText.textContent = `${levelXp} / ${xpPerLevel} XP`;
  if (!els.xpSegments) {
    els.xpSegments = document.createElement("div");
    els.xpSegments.id = "xpSegments";
    els.xpSegments.className = "xp-segments";
    els.xpTrack?.append(els.xpSegments);
  }
  els.xpSegments.innerHTML = "";

  for (let index = 0; index < xpSegmentsPerLevel; index += 1) {
    const segment = document.createElement("span");
    const classes = ["xp-segment"];

    if (index < activeSegments) classes.push("filled");
    if (index === flashSegment) classes.push("flash");

    segment.className = classes.join(" ");
    els.xpSegments.append(segment);
  }
}

function addXp(amount) {
  const startXp = totalXp;
  totalXp += amount;
  saveXp();
  xpAnimationQueue = xpAnimationQueue.then(() => animateXpGain(startXp, totalXp));
}

function animateXpGain(startXp, endXp) {
  const steps = Math.max(0, Math.floor((endXp - startXp) / xpSegmentSize));
  const stepMs = 150;

  if (steps === 0) {
    renderXp();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    for (let step = 1; step <= steps; step += 1) {
      window.setTimeout(() => {
        const xpValue = startXp + step * xpSegmentSize;
        const { levelXp } = xpState(xpValue, true);
        renderXp(xpValue, xpSegmentFor(levelXp), true);
      }, step * stepMs);
    }

    window.setTimeout(() => {
      renderXp();
      resolve();
    }, (steps + 3) * stepMs);
  });
}

function awardQuizXp() {
  if (sessionAwarded || sessionResults.length < session.length) return;

  const accuracy = accuracySummary(sessionResults) ?? 0;
  addXp(accuracy >= accuracyTarget ? quizTargetXp : quizXp);
  sessionAwarded = true;
}

function awardStreakXp(correct) {
  currentStreak = correct ? currentStreak + 1 : 0;
  if (currentStreak === 0 || currentStreak % streakTarget !== 0) return;

  addXp(streakXp);
}

function renderProgressPills() {
  const resultsByIndex = new Map(sessionResults.map((result) => [result.question_index, result]));
  els.progressPills.innerHTML = "";

  for (let index = 0; index < maxQuestions; index += 1) {
    const pill = document.createElement("span");
    const result = resultsByIndex.get(index);
    const classes = ["progress-pill"];

    if (index >= session.length) {
      classes.push("unused");
    } else if (result) {
      classes.push(result.correct ? "correct" : "incorrect");
    } else if (index === currentIndex) {
      classes.push("current");
    }

    pill.className = classes.join(" ");
    pill.setAttribute("aria-label", `Question ${index + 1}`);
    els.progressPills.append(pill);
  }
}

function renderHistoryBars() {
  els.historyBars.innerHTML = "";

  accuracyWindows.forEach((windowSize) => {
    const recent = results.slice(-windowSize);
    const accuracy = accuracySummary(recent);
    const displayAccuracy = accuracy ?? 0;
    const color = accuracyRgb(accuracy ?? 100).join(", ");
    const row = document.createElement("div");
    row.className = "history-row";
    row.style.setProperty("--history-value", `${displayAccuracy}%`);
    row.style.setProperty("--history-color", color);

    const label = document.createElement("span");
    label.className = "history-label";
    label.textContent = `Last ${windowSize}`;

    const track = document.createElement("div");
    track.className = "history-track";

    const value = document.createElement("span");
    value.className = "history-value";
    value.textContent = accuracy === null ? "No attempts" : `${accuracy}% (${recent.length})`;

    row.append(label, track, value);
    els.historyBars.append(row);
  });
}

function renderSavedWords() {
  els.savedCount.textContent = String(savedWords.length);
  els.savedPreview.innerHTML = "";

  if (savedWords.length === 0) {
    const empty = document.createElement("span");
    empty.className = "saved-item";
    empty.textContent = "No saved words yet";
    els.savedPreview.append(empty);
    return;
  }

  savedWords.slice(0, 8).forEach((word) => {
    const item = document.createElement("span");
    item.className = "saved-item";
    item.textContent = word.front;
    els.savedPreview.append(item);
  });
}

function renderAnswer() {
  els.answerLine.innerHTML = "";
  selected.forEach(({ chunk, index }) => {
    const button = document.createElement("button");
    button.className = "pill selected";
    button.type = "button";
    button.textContent = chunk;
    button.addEventListener("click", () => removeSelected(index));
    els.answerLine.append(button);
  });
}

function renderChunks() {
  const exercise = currentExercise();
  els.chunkBank.innerHTML = "";
  shuffledChunkOrder.forEach(({ chunk, index }) => {
    const button = document.createElement("button");
    button.className = "pill";
    button.type = "button";
    button.textContent = lowerFirst(chunk);
    button.disabled = selectedIndexes.has(index);
    button.addEventListener("click", () => addSelected(chunk, index));
    els.chunkBank.append(button);
  });

  els.submitButton.disabled = !awaitingNext && (!exercise || selected.length === 0);
}

function renderExercise() {
  awaitingNext = false;
  selected = [];
  selectedIndexes = new Set();
  els.lessonTitle.textContent = currentLessonTitle();
  els.feedback.className = "feedback hidden";
  els.questionCounter.className = "";
  els.questionCounter.hidden = true;
  els.submitButton.textContent = "Submit";

  const exercise = currentExercise();
  if (!exercise) {
    els.questionCounter.hidden = false;
    els.questionCounter.textContent = "No questions";
    els.promptText.textContent = "No exercises found in this lesson.";
    els.answerLine.innerHTML = "";
    els.chunkBank.innerHTML = "";
    els.submitButton.disabled = true;
    renderStats();
    return;
  }

  shuffledChunkOrder = shuffle(exercise.chunks.map((chunk, index) => ({ chunk, index })));
  els.questionCounter.textContent = "";
  els.promptText.textContent = promptText(exercise);
  renderAnswer();
  renderChunks();
  renderStats();
  renderSavedWords();
}

function addSelected(chunk, index) {
  if (selectedIndexes.has(index) || !els.feedback.classList.contains("hidden")) return;
  selected.push({ chunk, index });
  selectedIndexes.add(index);
  renderAnswer();
  renderChunks();
}

function removeSelected(index) {
  if (!els.feedback.classList.contains("hidden")) return;
  const removeAt = selected.findIndex((item) => item.index === index);
  if (removeAt === -1) return;
  selected.splice(removeAt, 1);
  selectedIndexes.delete(index);
  renderAnswer();
  renderChunks();
}

function undo() {
  if (!els.feedback.classList.contains("hidden")) return;
  const last = selected.pop();
  if (!last) return;
  selectedIndexes.delete(last.index);
  renderAnswer();
  renderChunks();
}

function submitAnswer() {
  const exercise = currentExercise();
  if (!exercise || selected.length === 0) return;

  const attempt = selected.map((item) => item.chunk);
  const correct = arraysEqual(attempt, exercise.answer);
  const lesson = currentLesson();
  const result = {
    date: new Date().toISOString(),
    lesson_id: lesson.id,
    lesson_name: lesson.name,
    exercise_id: exercise.id,
    question_index: currentIndex,
    correct,
    prompt: promptText(exercise),
    attempt,
    answer: exercise.answer,
    patterns: exercise.patterns ?? [],
    verbs: exercise.verbs ?? [],
    person: exercise.person,
    tense: exercise.tense,
    level: exercise.level
  };

  results.push(result);
  sessionResults.push(result);
  saveResults();
  awardStreakXp(correct);
  if (currentIndex + 1 >= session.length) awardQuizXp();

  if (correct) playCorrectSound();
  els.questionCounter.className = `answer-mark ${correct ? "correct" : "incorrect"}`;
  els.questionCounter.hidden = false;
  els.questionCounter.textContent = correct ? "✓" : "×";
  els.feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  els.feedbackTitle.textContent = correct ? "Correct" : "Check the order";
  els.correctAnswer.textContent = polishedAnswer(exercise.answer);
  els.englishAnswer.textContent = answerEnglish(exercise) || "No English translation saved.";
  els.attemptAnswer.textContent = polishedAnswer(attempt);
  renderSaveChunkButtons(exercise, lesson);
  awaitingNext = true;
  els.submitButton.textContent = "Next";
  els.submitButton.disabled = false;
  renderStats();
}

function handlePrimaryAction() {
  if (awaitingNext) {
    nextExercise();
    return;
  }
  submitAnswer();
}

function renderSaveChunkButtons(exercise, lesson) {
  els.saveChunkList.innerHTML = "";
  exercise.answer.forEach((chunk) => {
    const button = document.createElement("button");
    const alreadySaved = savedWordExists(chunk, lesson.id);
    button.className = `save-chip ${alreadySaved ? "saved" : ""}`;
    button.type = "button";
    button.textContent = alreadySaved ? `Saved: ${chunk}` : chunk;
    button.disabled = alreadySaved;
    button.addEventListener("click", () => {
      const saved = addSavedWord({
        front: chunk,
        back: answerEnglish(exercise),
        example: polishedAnswer(exercise.answer),
        tags: currentTags(exercise, lesson),
        lesson,
        exercise,
        source: "exercise-chunk"
      });
      if (saved) {
        button.classList.add("saved");
        button.textContent = `Saved: ${chunk}`;
        button.disabled = true;
      }
    });
    els.saveChunkList.append(button);
  });
}

function nextExercise() {
  if (currentIndex + 1 >= session.length) {
    startSession();
    return;
  }

  currentIndex += 1;
  renderExercise();
}

function skipExercise() {
  if (!session.length) return;
  nextExercise();
}

function resetResults() {
  if (!confirm("Clear saved results on this device?")) return;
  results = [];
  sessionResults = [];
  saveResults();
  renderStats();
}

function saveManualWord() {
  const lesson = currentLesson();
  const exercise = currentExercise();
  const saved = addSavedWord({
    front: els.saveFrontInput.value,
    back: els.saveBackInput.value,
    example: exercise ? polishedAnswer(exercise.answer) : "",
    tags: ["spanish", lesson?.id, "manual"].filter(Boolean),
    lesson,
    exercise,
    source: "manual"
  });

  if (saved) {
    els.saveFrontInput.value = "";
    els.saveBackInput.value = "";
  }
}

function csvCell(value) {
  return String(value ?? "").replaceAll("\t", " ").replaceAll("\n", " ");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportSavedCsv() {
  const headers = ["front", "back", "example", "tags", "lesson", "source"];
  const rows = savedWords.map((item) => [
    item.front,
    item.back,
    item.example,
    item.tags.join(" "),
    item.lesson_name,
    item.source
  ].map(csvCell).join("\t"));
  downloadFile("spanish-saved-words.tsv", [headers.join("\t"), ...rows].join("\n"), "text/tab-separated-values");
}

function exportSavedJson() {
  downloadFile("spanish-saved-words.json", JSON.stringify(savedWords, null, 2), "application/json");
}

function clearSavedWords() {
  if (!confirm("Clear saved words on this device?")) return;
  savedWords = [];
  saveSavedWords();
  renderSavedWords();
}

function openMenu() {
  els.mobileMenu.classList.add("open");
  els.mobileMenu.setAttribute("aria-hidden", "false");
  els.menuOverlay.classList.remove("hidden");
}

function closeMenu() {
  els.mobileMenu.classList.remove("open");
  els.mobileMenu.setAttribute("aria-hidden", "true");
  els.menuOverlay.classList.add("hidden");
}

function bindEvents() {
  els.lessonSelect.addEventListener("change", loadLesson);
  els.openMenuButton.addEventListener("click", openMenu);
  els.closeMenuButton.addEventListener("click", closeMenu);
  els.menuOverlay.addEventListener("click", closeMenu);
  els.shuffleButton.addEventListener("click", shuffleLesson);
  els.resetButton.addEventListener("click", resetResults);
  els.undoButton.addEventListener("click", undo);
  els.skipButton.addEventListener("click", skipExercise);
  els.submitButton.addEventListener("click", handlePrimaryAction);
  els.saveManualButton.addEventListener("click", saveManualWord);
  els.exportCsvButton.addEventListener("click", exportSavedCsv);
  els.exportJsonButton.addEventListener("click", exportSavedJson);
  els.clearSavedButton.addEventListener("click", clearSavedWords);
}

async function init() {
  renderXp();
  lessons = await loadJson(lessonIndexFile);
  populateLessons();
  bindEvents();
  await loadLesson();
  renderSavedWords();
}

init().catch((error) => {
  els.promptText.textContent = "The exercise library could not be loaded.";
  console.error(error);
});

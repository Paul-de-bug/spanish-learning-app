const maxQuestions = 20;
const lessonIndexFile = "./data/lesson-index.json";
const storageKey = "spanish-pills-mobile-results";
const savedWordsKey = "spanish-pills-saved-words";

const els = {
  lessonSelect: document.querySelector("#lessonSelect"),
  lessonDescription: document.querySelector("#lessonDescription"),
  shuffleButton: document.querySelector("#shuffleButton"),
  resetButton: document.querySelector("#resetButton"),
  progressText: document.querySelector("#progressText"),
  correctText: document.querySelector("#correctText"),
  accuracyText: document.querySelector("#accuracyText"),
  questionCounter: document.querySelector("#questionCounter"),
  tagText: document.querySelector("#tagText"),
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
let savedWords = loadSavedWords();
let awaitingNext = false;

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

function saveResults() {
  localStorage.setItem(storageKey, JSON.stringify(results));
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
}

function startSession() {
  session = sample(exercises);
  currentIndex = 0;
  selected = [];
  selectedIndexes = new Set();
  renderExercise();
}

function renderStats() {
  const lesson = currentLesson();
  const lessonResults = results.filter((result) => result.lesson_id === lesson?.id);
  const correct = lessonResults.filter((result) => result.correct).length;
  const accuracy = lessonResults.length ? Math.round((correct / lessonResults.length) * 100) : 0;

  els.progressText.textContent = `${Math.min(currentIndex + 1, session.length)} / ${session.length}`;
  els.correctText.textContent = String(correct);
  els.accuracyText.textContent = `${accuracy}%`;
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
  els.feedback.className = "feedback hidden";
  els.questionCounter.className = "";
  els.submitButton.textContent = "Submit";

  const exercise = currentExercise();
  if (!exercise) {
    els.questionCounter.textContent = "No questions";
    els.tagText.textContent = "";
    els.promptText.textContent = "No exercises found in this lesson.";
    els.answerLine.innerHTML = "";
    els.chunkBank.innerHTML = "";
    els.submitButton.disabled = true;
    renderStats();
    return;
  }

  shuffledChunkOrder = shuffle(exercise.chunks.map((chunk, index) => ({ chunk, index })));
  els.questionCounter.textContent = `Question ${currentIndex + 1} of ${session.length}`;
  els.tagText.textContent = [exercise.tense, exercise.person, exercise.level].filter(Boolean).join(" · ");
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
  saveResults();

  els.questionCounter.className = `answer-mark ${correct ? "correct" : "incorrect"}`;
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
  currentIndex = (currentIndex + 1) % session.length;
  renderExercise();
}

function skipExercise() {
  if (!session.length) return;
  nextExercise();
}

function resetResults() {
  if (!confirm("Clear saved results on this device?")) return;
  results = [];
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

function bindEvents() {
  els.lessonSelect.addEventListener("change", loadLesson);
  els.shuffleButton.addEventListener("click", startSession);
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

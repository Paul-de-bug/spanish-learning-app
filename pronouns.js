const roundLength = 10;

const verbs = [
  { infinitive: "dar", forms: ["doy", "das", "da", "damos", "dais", "dan"] },
  { infinitive: "ver", forms: ["veo", "ves", "ve", "vemos", "veis", "ven"] },
  { infinitive: "llamar", forms: ["llamo", "llamas", "llama", "llamamos", "llamáis", "llaman"] },
  { infinitive: "ayudar", forms: ["ayudo", "ayudas", "ayuda", "ayudamos", "ayudáis", "ayudan"] },
  { infinitive: "escuchar", forms: ["escucho", "escuchas", "escucha", "escuchamos", "escucháis", "escuchan"] },
  { infinitive: "conocer", forms: ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"] },
  { infinitive: "buscar", forms: ["busco", "buscas", "busca", "buscamos", "buscáis", "buscan"] }
];

const leftGroups = [
  { id: "yo", emoji: ["👨"], form: 0, object: "me" },
  { id: "nosotros", emoji: ["👨", "👨"], form: 3, object: "nos" }
];
const rightGroups = [
  { id: "el", emoji: ["👨"], form: 2, object: "lo" },
  { id: "ella", emoji: ["👩"], form: 2, object: "la" },
  { id: "ellos", emoji: ["👨", "👨"], form: 5, object: "los" },
  { id: "ellas", emoji: ["👩", "👩"], form: 5, object: "las" },
  { id: "cosa", emoji: ["⚫"], object: "lo", objectOnly: true }
];

const objectChoices = ["me", "nos", "lo", "la", "los", "las"];
const coreQuestions = [
  { verb: "dar", left: "yo", right: "ellas", direction: "right" },
  { verb: "ver", left: "nosotros", right: "el", direction: "left" },
  { verb: "ver", left: "yo", right: "cosa", direction: "right" }
];

const els = {
  newRoundButton: document.querySelector("#newRoundButton"),
  progress: document.querySelector("#pronounProgress"),
  accuracy: document.querySelector("#pronounAccuracy"),
  verb: document.querySelector("#pronounVerb"),
  scene: document.querySelector("#pronounScene"),
  left: document.querySelector("#leftGroup"),
  right: document.querySelector("#rightGroup"),
  arrow: document.querySelector("#directionArrow"),
  answerLine: document.querySelector("#pronounAnswerLine"),
  chunkBank: document.querySelector("#pronounChunkBank"),
  undoButton: document.querySelector("#pronounUndoButton"),
  skipButton: document.querySelector("#pronounSkipButton"),
  submitButton: document.querySelector("#pronounSubmitButton"),
  feedback: document.querySelector("#pronounFeedback"),
  feedbackTitle: document.querySelector("#pronounFeedbackTitle"),
  correctAnswer: document.querySelector("#pronounCorrectAnswer")
};

let round = [];
let currentIndex = 0;
let correctCount = 0;
let answeredCount = 0;
let selected = [];
let awaitingNext = false;

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function createQuestion() {
  const verb = randomItem(verbs);
  const left = randomItem(leftGroups);
  const right = randomItem(rightGroups);
  const direction = right.objectOnly ? "right" : randomItem(["left", "right"]);

  return buildQuestion(verb, left, right, direction);
}

function buildQuestion(verb, left, right, direction) {
  const subject = direction === "right" ? left : right;
  const object = direction === "right" ? right : left;

  return {
    verb,
    left,
    right,
    direction,
    answer: [object.object, verb.forms[subject.form]]
  };
}

function startRound() {
  const required = coreQuestions.map((question) => buildQuestion(
    verbs.find((verb) => verb.infinitive === question.verb),
    leftGroups.find((group) => group.id === question.left),
    rightGroups.find((group) => group.id === question.right),
    question.direction
  ));
  round = shuffle([
    ...required,
    ...Array.from({ length: roundLength - required.length }, createQuestion)
  ]);
  currentIndex = 0;
  correctCount = 0;
  answeredCount = 0;
  renderQuestion();
}

function currentQuestion() {
  return round[currentIndex];
}

function renderPersonGroup(container, person) {
  container.innerHTML = "";

  const emojis = document.createElement("div");
  emojis.className = "person-emojis";
  emojis.setAttribute("aria-hidden", "true");
  person.emoji.forEach((emoji) => {
    const face = document.createElement("span");
    face.textContent = emoji;
    emojis.append(face);
  });

  container.append(emojis);
}

function renderStats() {
  els.progress.textContent = `${currentIndex + 1} / ${roundLength}`;
  els.accuracy.textContent = answeredCount ? `${Math.round((correctCount / answeredCount) * 100)}%` : "0%";
}

function distractors(items, answer, count) {
  return shuffle(items.filter((item) => item !== answer)).slice(0, count);
}

function answerChunks(question) {
  const [answerPronoun, answerForm] = question.answer;
  const relevantForms = [0, 2, 3, 5].map((index) => question.verb.forms[index]);
  return shuffle([
    answerPronoun,
    ...distractors(objectChoices, answerPronoun, 2),
    answerForm,
    ...distractors(relevantForms, answerForm, 2)
  ]).map((chunk, index) => ({ chunk, index }));
}

function renderAnswer() {
  els.answerLine.innerHTML = "";
  selected.forEach(({ chunk }) => {
    const pill = document.createElement("button");
    pill.className = "pill selected";
    pill.type = "button";
    pill.textContent = chunk;
    pill.addEventListener("click", undo);
    els.answerLine.append(pill);
  });
}

function renderBank() {
  const question = currentQuestion();
  els.chunkBank.innerHTML = "";
  answerChunks(question).forEach(({ chunk, index }) => {
    const pill = document.createElement("button");
    pill.className = "pill";
    pill.type = "button";
    pill.textContent = chunk;
    pill.dataset.index = String(index);
    pill.addEventListener("click", () => selectChunk(chunk, pill));
    els.chunkBank.append(pill);
  });
}

function renderQuestion() {
  const question = currentQuestion();
  selected = [];
  awaitingNext = false;
  els.verb.textContent = question.verb.infinitive;
  els.arrow.textContent = question.direction === "right" ? "→" : "←";
  els.scene.setAttribute(
    "aria-label",
    question.direction === "right" ? "La izquierda hace la acción" : "La derecha hace la acción"
  );
  renderPersonGroup(els.left, question.left);
  renderPersonGroup(els.right, question.right);
  els.feedback.className = "feedback hidden";
  els.submitButton.textContent = "Comprobar";
  els.submitButton.disabled = true;
  renderAnswer();
  renderBank();
  renderStats();
}

function selectChunk(chunk, pill) {
  if (awaitingNext || selected.length >= 2 || pill.disabled) return;
  selected.push({ chunk, pill });
  pill.disabled = true;
  renderAnswer();
  els.submitButton.disabled = selected.length !== 2;
}

function undo() {
  if (awaitingNext) return;
  const removed = selected.pop();
  if (!removed) return;
  removed.pill.disabled = false;
  renderAnswer();
  els.submitButton.disabled = selected.length !== 2;
}

function submitAnswer() {
  const question = currentQuestion();
  const attempt = selected.map(({ chunk }) => chunk);
  const correct = attempt.every((chunk, index) => chunk === question.answer[index]);

  answeredCount += 1;
  if (correct) correctCount += 1;
  awaitingNext = true;
  els.feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  els.feedbackTitle.textContent = correct ? "Correcto" : "Mira la dirección de la flecha";
  els.correctAnswer.textContent = `${question.answer.join(" ")}.`;
  els.submitButton.textContent = currentIndex + 1 === roundLength ? "Nueva ronda" : "Siguiente";
  els.submitButton.disabled = false;
  renderStats();
}

function nextQuestion() {
  if (currentIndex + 1 >= roundLength) {
    startRound();
    return;
  }
  currentIndex += 1;
  renderQuestion();
}

function handleSubmit() {
  if (awaitingNext) {
    nextQuestion();
    return;
  }
  if (selected.length === 2) submitAnswer();
}

els.newRoundButton.addEventListener("click", startRound);
els.undoButton.addEventListener("click", undo);
els.skipButton.addEventListener("click", nextQuestion);
els.submitButton.addEventListener("click", handleSubmit);

startRound();

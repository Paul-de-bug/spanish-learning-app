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

const people = [
  { id: "yo", label: "YO", emoji: ["🧑"], form: 0, object: "me" },
  { id: "tu", label: "TÚ", emoji: ["🧑"], form: 1, object: "te" },
  { id: "el", label: "ÉL", emoji: ["👨"], form: 2, object: "lo" },
  { id: "ella", label: "ELLA", emoji: ["👩"], form: 2, object: "la" },
  { id: "nosotros", label: "NOSOTROS", emoji: ["👨", "👨", "👨"], form: 3, object: "nos" },
  { id: "nosotras", label: "NOSOTRAS", emoji: ["👩", "👩", "👩"], form: 3, object: "nos" },
  { id: "vosotros", label: "VOSOTROS", emoji: ["👨", "👨", "👨"], form: 4, object: "os" },
  { id: "vosotras", label: "VOSOTRAS", emoji: ["👩", "👩", "👩"], form: 4, object: "os" },
  { id: "ellos", label: "ELLOS", emoji: ["👨", "👨", "👨"], form: 5, object: "los" },
  { id: "ellas", label: "ELLAS", emoji: ["👩", "👩", "👩"], form: 5, object: "las" }
];

const objectChoices = ["me", "te", "lo", "la", "nos", "os", "los", "las"];
const coreQuestions = [
  { verb: "dar", subject: "tu", object: "yo" },
  { verb: "ver", subject: "ellas", object: "ellos" },
  { verb: "dar", subject: "yo", object: "ellas" }
];

const els = {
  newRoundButton: document.querySelector("#newRoundButton"),
  progress: document.querySelector("#pronounProgress"),
  accuracy: document.querySelector("#pronounAccuracy"),
  verb: document.querySelector("#pronounVerb"),
  subject: document.querySelector("#subjectGroup"),
  object: document.querySelector("#objectGroup"),
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
  const subject = randomItem(people);
  const possibleObjects = people.filter((person) => (
    person.id !== subject.id
    && !([3, 4].includes(subject.form) && person.form === subject.form)
  ));
  const object = randomItem(possibleObjects);

  return buildQuestion(verb, subject, object);
}

function buildQuestion(verb, subject, object) {
  return {
    verb,
    subject,
    object,
    answer: [object.object, verb.forms[subject.form]]
  };
}

function startRound() {
  const required = coreQuestions.map((question) => buildQuestion(
    verbs.find((verb) => verb.infinitive === question.verb),
    people.find((person) => person.id === question.subject),
    people.find((person) => person.id === question.object)
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
  container.setAttribute("aria-label", person.label);

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

function answerChunks(question) {
  const nearbyForms = verbs
    .filter((verb) => verb.infinitive === question.verb.infinitive)
    .flatMap((verb) => verb.forms);
  return shuffle([
    ...objectChoices,
    ...nearbyForms
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
  renderPersonGroup(els.subject, question.subject);
  renderPersonGroup(els.object, question.object);
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
  els.feedbackTitle.textContent = correct ? "Correcto" : "Mira el sujeto y el objeto";
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

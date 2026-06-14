const pairsPerRound = 10;
const roundLength = pairsPerRound * 2;

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
  { id: "yo", emoji: ["👨"], form: 0, object: "me" }
];
const partnerGroups = [
  { id: "tu-hombre", emoji: ["👨"], form: 1, object: "te", zone: "you" },
  { id: "tu-mujer", emoji: ["👩"], form: 1, object: "te", zone: "you" },
  { id: "vosotros", emoji: ["👨", "👨"], form: 4, object: "os", zone: "you" },
  { id: "vosotras", emoji: ["👩", "👩"], form: 4, object: "os", zone: "you" },
  { id: "el", emoji: ["👨"], form: 2, object: "lo", zone: "third" },
  { id: "ella", emoji: ["👩"], form: 2, object: "la", zone: "third" },
  { id: "ellos", emoji: ["👨", "👨"], form: 5, object: "los", zone: "third" },
  { id: "ellas", emoji: ["👩", "👩"], form: 5, object: "las", zone: "third" },
  { id: "cosa", emoji: ["⚫"], object: "lo", zone: "third", objectOnly: true }
];

const objectChoices = ["me", "te", "os", "lo", "la", "los", "las"];
const me = leftGroups[0];
const reversiblePartners = partnerGroups.filter((partner) => !partner.objectOnly);

const els = {
  newRoundButton: document.querySelector("#newRoundButton"),
  progress: document.querySelector("#pronounProgress"),
  accuracy: document.querySelector("#pronounAccuracy"),
  verb: document.querySelector("#pronounVerb"),
  scene: document.querySelector("#pronounScene") ?? document.querySelector(".pronoun-scene"),
  me: document.querySelector("#meGroup"),
  you: document.querySelector("#youGroup"),
  third: document.querySelector("#thirdGroup"),
  legacyLeft: document.querySelector("#leftGroup") ?? document.querySelector("#subjectGroup"),
  legacyRight: document.querySelector("#rightGroup") ?? document.querySelector("#objectGroup"),
  arrow: document.querySelector("#directionArrow") ?? document.querySelector(".action-arrow span"),
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

function shuffle(items) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function buildQuestion(verb, partner, direction, pairId) {
  const subject = direction === "out" ? me : partner;
  const object = direction === "out" ? partner : me;

  return {
    pairId,
    verb,
    me,
    partner,
    direction,
    answer: [object.object, verb.forms[subject.form]]
  };
}

const exercisePairs = verbs
  .flatMap((verb) => reversiblePartners.map((partner) => {
    const pairId = `${verb.infinitive}-${partner.id}`;
    return [
      buildQuestion(verb, partner, "out", pairId),
      buildQuestion(verb, partner, "in", pairId)
    ];
  }))
  .slice(0, 50);

function startRound() {
  round = shuffle(exercisePairs)
    .slice(0, pairsPerRound)
    .flatMap((pair) => pair);
  currentIndex = 0;
  correctCount = 0;
  answeredCount = 0;
  renderQuestion();
}

function currentQuestion() {
  return round[currentIndex];
}

function renderPersonGroup(container, person) {
  if (!container) return;
  container.innerHTML = "";
  if (!person) return;

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

function arrowFor(question) {
  if (question.partner.zone === "you") return question.direction === "out" ? "↖" : "↘";
  return question.direction === "out" ? "↗" : "↙";
}

function renderScene(question) {
  els.arrow.textContent = arrowFor(question);

  if (els.me && els.you && els.third) {
    renderPersonGroup(els.me, question.me);
    renderPersonGroup(els.you, question.partner.zone === "you" ? question.partner : null);
    renderPersonGroup(els.third, question.partner.zone === "third" ? question.partner : null);
    return;
  }

  renderPersonGroup(els.legacyLeft, question.me);
  renderPersonGroup(els.legacyRight, question.partner);
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
  const relevantForms = question.verb.forms;
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
  els.scene.setAttribute(
    "aria-label",
    question.direction === "out" ? "Yo hago la acción" : "La otra persona hace la acción"
  );
  renderScene(question);
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

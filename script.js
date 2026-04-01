// Pomodoro settings
const DEFAULT_WORK = 25 * 60;
const DEFAULT_SHORT = 5 * 60;
const DEFAULT_LONG = 15 * 60;
const STORAGE_KEY = "focusflow-study-goals";

const playlist = [
  "assets/music/song1.mp3",
  "assets/music/song2.mp3",
  "assets/music/song3.mp3"
];

let currentTrack = 0;

const audio = new Audio();
audio.src = playlist[currentTrack];
audio.loop = false;

// Auto play next song
audio.addEventListener("ended", () => {
  currentTrack = (currentTrack + 1) % playlist.length;
  audio.src = playlist[currentTrack];
  audio.play();
});
let timer;
let timeLeft = DEFAULT_WORK;
let isRunning = false;
let mode = "work";
let pomodoros = 0;
let discordConnected = false;
let discordPresenceEnabled = false;
let editingGoalId = null;
let studyGoals = loadStudyGoals();
let activeGoalId = studyGoals.find((goal) => !goal.completed)?.id || null;

// Elements
const timeEl = document.getElementById("time");
const phaseEl = document.getElementById("phase");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const modeInputs = document.querySelectorAll('input[name="mode"]');

const spotifyStatus = document.getElementById("spotify-status");
const spotifyLoginBtn = document.getElementById("spotify-login");
const togglePlayBtn = document.getElementById("toggle-play");

const discordStatus = document.getElementById("discord-status");
const discordConnectBtn = document.getElementById("discord-connect");
const discordPresenceBtn = document.getElementById("discord-presence");

const pomodorosEl = document.getElementById("pomodoros");
const wallpaperButtons = document.querySelectorAll(".wallpaper-btn");

const studyTopicInput = document.getElementById("study-topic");
const studyGoalInput = document.getElementById("study-goal");
const saveGoalBtn = document.getElementById("save-goal");
const goalSummaryEl = document.getElementById("goal-summary");
const goalProgressFill = document.getElementById("goal-progress-fill");
const goalProgressText = document.getElementById("goal-progress-text");
const goalProgressPercent = document.getElementById("goal-progress-percent");
const goalListEl = document.getElementById("goal-list");
const activeTopicEl = document.getElementById("active-topic");
const goalStatusEl = document.getElementById("goal-status");

// Storage helpers
function loadStudyGoals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveStudyGoals() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studyGoals));
}

function getActiveGoal() {
  return studyGoals.find((goal) => goal.id === activeGoalId) || null;
}

function createGoal(topic, target) {
  return {
    id: `goal-${Date.now()}`,
    topic,
    target,
    completedSessions: 0,
    completed: false,
  };
}

// Update display
function updateTime() {
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  timeEl.textContent = `${mins}:${secs}`;
}

// Timer logic
function startTimer() {
  if (isRunning) return;

  isRunning = true;
  updateDiscordRPC();
  audio.play();

  timer = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timer);
      isRunning = false;

      if (mode === "work") {
        pomodoros++;
        pomodorosEl.textContent = pomodoros;
        incrementActiveGoalSession();

        if (pomodoros % 4 === 0) {
          setMode("long");
        } else {
          setMode("short");
        }
      }

      timeLeft = getDuration();
      startTimer();
    } else {
      timeLeft--;
      updateTime();
      updateDiscordRPC();
    }
  }, 1000);
}

function getDuration() {
  switch (mode) {
    case "work":
      return DEFAULT_WORK;
    case "short":
      return DEFAULT_SHORT;
    case "long":
      return DEFAULT_LONG;
    default:
      return DEFAULT_WORK;
  }
}

function setMode(newMode) {
  mode = newMode;
  phaseEl.textContent = formatModeLabel(mode);
  timeLeft = getDuration();
  updateTime();
  updateDiscordRPC();
}

function formatModeLabel(currentMode) {
  switch (currentMode) {
    case "short":
      return "Short break";
    case "long":
      return "Long break";
    default:
      return "Work";
  }
}

// Spotify (simplified client)
function handleSpotifyLogin() {
  spotifyStatus.textContent = "🎧 Local music ready";
  spotifyLoginBtn.disabled = true;
}

function toggleSpotifyPlay() {
  if (audio.paused) {
    audio.play();
    spotifyStatus.textContent = "🎧 Playing music";
  } else {
    audio.pause();
    spotifyStatus.textContent = "⏸️ Music paused";
  }
}

// Discord integration (browser-friendly simulation)
function connectDiscord() {
  if (discordConnected) return;

  discordStatus.textContent = "🟣 Connecting Discord workspace...";
  discordConnectBtn.disabled = true;

  setTimeout(() => {
    discordConnected = true;
    discordPresenceEnabled = true;
    discordConnectBtn.textContent = "Discord linked";
    discordPresenceBtn.textContent = "Presence live";
    updateDiscordRPC();
  }, 1000);
}

function toggleDiscordPresence() {
  if (!discordConnected) {
    discordStatus.textContent = "Link Discord first to share your focus session.";
    return;
  }

  discordPresenceEnabled = !discordPresenceEnabled;
  discordPresenceBtn.textContent = discordPresenceEnabled
    ? "Presence live"
    : "Show Focus Session";

  updateDiscordRPC();
}

function updateDiscordRPC() {
  if (!discordConnected) {
    discordStatus.textContent = "Discord not connected";
    return;
  }

  if (!discordPresenceEnabled) {
    discordStatus.textContent = "🟣 Discord linked, but focus presence is paused.";
    return;
  }

  const sessionState = isRunning ? "Focusing now" : "Planning next session";
  const activeGoal = getActiveGoal();
  const studyLabel = activeGoal ? activeGoal.topic : "No active topic";
  discordStatus.textContent = `🟣 ${sessionState} • ${formatModeLabel(mode)} • ${studyLabel}`;
}

// Wallpaper switching
function setWallpaper(themeName) {
  document.body.dataset.wallpaper = themeName;

  wallpaperButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.wallpaper === themeName);
  });
}

// Study tracker
function resetGoalForm() {
  editingGoalId = null;
  studyTopicInput.value = "";
  studyGoalInput.value = "";
  saveGoalBtn.textContent = "Save Study Goal";
}

function handleSaveGoal() {
  const topic = studyTopicInput.value.trim();
  const target = Number(studyGoalInput.value);

  if (!topic || !target || target < 1) {
    goalSummaryEl.textContent = "Enter a valid topic and a final session goal.";
    return;
  }

  const duplicateGoal = studyGoals.find(
    (goal) =>
      goal.topic.toLowerCase() === topic.toLowerCase() &&
      goal.id !== editingGoalId &&
      !goal.completed
  );

  if (duplicateGoal) {
    goalSummaryEl.textContent = "That topic already exists. Edit it from the list instead.";
    return;
  }

  if (editingGoalId) {
    const editingGoal = studyGoals.find((goal) => goal.id === editingGoalId);

    if (editingGoal) {
      editingGoal.topic = topic;
      editingGoal.target = target;
      editingGoal.completed = editingGoal.completedSessions >= target;
      if (editingGoal.completedSessions > target) {
        editingGoal.completedSessions = target;
      }
      activeGoalId = editingGoal.id;
      goalSummaryEl.textContent = `Updated ${editingGoal.topic} with a ${target}-session goal.`;
    }
  } else {
    const newGoal = createGoal(topic, target);
    studyGoals.unshift(newGoal);
    activeGoalId = newGoal.id;
    goalSummaryEl.textContent = `Tracking ${topic} until you complete ${target} sessions.`;
  }

  resetGoalForm();
  saveStudyGoals();
  renderGoals();
  updateDiscordRPC();
}

function incrementActiveGoalSession() {
  const activeGoal = getActiveGoal();

  if (!activeGoal) return;

  activeGoal.completedSessions += 1;

  if (activeGoal.completedSessions >= activeGoal.target) {
    activeGoal.completedSessions = activeGoal.target;
    activeGoal.completed = true;
    goalSummaryEl.textContent = `Goal complete: ${activeGoal.topic} finished in ${activeGoal.target} sessions.`;

    const nextGoal = studyGoals.find(
      (goal) => goal.id !== activeGoal.id && !goal.completed
    );
    activeGoalId = nextGoal ? nextGoal.id : null;
  }

  saveStudyGoals();
  renderGoals();
}

function setActiveGoal(goalId) {
  activeGoalId = goalId;
  const activeGoal = getActiveGoal();

  if (activeGoal) {
    goalSummaryEl.textContent = `Now focusing on ${activeGoal.topic}. Keep going until ${activeGoal.target} sessions.`;
  }

  saveStudyGoals();
  renderGoals();
  updateDiscordRPC();
}

function startEditingGoal(goalId) {
  const goal = studyGoals.find((item) => item.id === goalId);

  if (!goal) return;

  editingGoalId = goal.id;
  studyTopicInput.value = goal.topic;
  studyGoalInput.value = goal.target;
  saveGoalBtn.textContent = "Update Goal";
  goalSummaryEl.textContent = `Editing ${goal.topic}. Update the topic or session target, then save.`;
}

function deleteGoal(goalId) {
  const deletingGoal = studyGoals.find((goal) => goal.id === goalId);

  if (!deletingGoal) return;

  studyGoals = studyGoals.filter((goal) => goal.id !== goalId);

  if (activeGoalId === goalId) {
    activeGoalId = studyGoals.find((goal) => !goal.completed)?.id || null;
  }

  if (editingGoalId === goalId) {
    resetGoalForm();
  }

  goalSummaryEl.textContent = `Removed ${deletingGoal.topic} from your tracked study goals.`;
  saveStudyGoals();
  renderGoals();
  updateDiscordRPC();
}

function renderGoals() {
  const activeGoal = getActiveGoal();

  activeTopicEl.textContent = activeGoal ? activeGoal.topic : "None";

  if (activeGoal) {
    const percent = Math.min(
      100,
      Math.round((activeGoal.completedSessions / activeGoal.target) * 100)
    );
    goalProgressFill.style.width = `${percent}%`;
    goalProgressText.textContent = `${activeGoal.completedSessions} / ${activeGoal.target} sessions`;
    goalProgressPercent.textContent = `${percent}%`;
    goalStatusEl.textContent = activeGoal.completed
      ? "Completed"
      : `${activeGoal.target - activeGoal.completedSessions} left`;

    if (!goalSummaryEl.textContent.includes("Goal complete")) {
      goalSummaryEl.textContent = `Current focus: ${activeGoal.topic} — ${activeGoal.completedSessions} of ${activeGoal.target} sessions finished.`;
    }
  } else {
    goalProgressFill.style.width = "0%";
    goalProgressText.textContent = "0 / 0 sessions";
    goalProgressPercent.textContent = "0%";
    goalStatusEl.textContent = studyGoals.length ? "All goals done" : "Not set";

    if (!studyGoals.length) {
      goalSummaryEl.textContent =
        "Pick a topic and set a session goal to start tracking long-term progress.";
    } else {
      goalSummaryEl.textContent = "Every tracked goal is completed. Add a new subject to continue.";
    }
  }

  if (!studyGoals.length) {
    goalListEl.innerHTML = '<p class="goal-empty">No study goals yet.</p>';
    return;
  }

  goalListEl.innerHTML = studyGoals
    .map((goal) => {
      const percent = Math.min(
        100,
        Math.round((goal.completedSessions / goal.target) * 100)
      );

      return `
        <div class="goal-item ${goal.id === activeGoalId ? "is-active" : ""}" data-goal-id="${goal.id}">
          <button class="goal-item__main" data-action="activate" data-goal-id="${goal.id}">
            <span class="goal-item__title">${goal.topic}</span>
            <span class="goal-item__meta">${goal.completedSessions}/${goal.target} sessions • ${goal.completed ? "Completed" : `${percent}% done`}</span>
          </button>
          <div class="goal-item__actions">
            <button class="goal-action-btn" data-action="edit" data-goal-id="${goal.id}">Edit</button>
            <button class="goal-action-btn goal-action-btn--danger" data-action="delete" data-goal-id="${goal.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

}

// Events
startBtn.addEventListener("click", startTimer);

pauseBtn.addEventListener("click", () => {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timer);
  updateDiscordRPC();
});

resetBtn.addEventListener("click", () => {
  isRunning = false;
  clearInterval(timer);
  setMode(mode);
  updateDiscordRPC();
});

modeInputs.forEach((radio) => {
  radio.addEventListener("change", () => {
    setMode(radio.value);
  });
});

spotifyLoginBtn.addEventListener("click", handleSpotifyLogin);
togglePlayBtn.addEventListener("click", toggleSpotifyPlay);

if (discordConnectBtn) {
  discordConnectBtn.addEventListener("click", connectDiscord);
}

if (discordPresenceBtn) {
  discordPresenceBtn.addEventListener("click", toggleDiscordPresence);
}

if (saveGoalBtn) {
  saveGoalBtn.addEventListener("click", handleSaveGoal);
}

if (goalListEl) {
  goalListEl.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");

    if (!actionButton) return;

    const { action, goalId } = actionButton.dataset;

    if (action === "activate") {
      setActiveGoal(goalId);
    }

    if (action === "edit") {
      startEditingGoal(goalId);
    }

    if (action === "delete") {
      deleteGoal(goalId);
    }
  });
}

wallpaperButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setWallpaper(button.dataset.wallpaper);
  });
});

pomodorosEl.addEventListener("DOMSubtreeModified", updateDiscordRPC);

// Initial setup
setMode("work");
setWallpaper("sunset");
renderGoals();
updateDiscordRPC();

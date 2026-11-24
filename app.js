// HabitFlow application state, theming, rendering, and interactions.
// This file manages the dashboard data, localStorage persistence, and UI updates.
const STORAGE_KEY = "habitflow-state-v1";
const THEME_STORAGE_KEY = "habitflow-theme";
const ACHIEVEMENTS_STORAGE_KEY = "habitflow-achievements-v1";
const GOALS_STORAGE_KEY = "habitflow-goals-v1";
const SETTINGS_STORAGE_KEY = "habitflow-settings-v1";

const DEFAULT_SETTINGS = {
  theme: "light",
  notifications: true,
  weeklySummary: true,
};

const HabitFlowApp = (() => {
  const today = new Date();
  const state = {
    habits: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
    currentMonth: today.getMonth(),
    currentYear: today.getFullYear(),
    achievementUnlocks: {},
  };

  const reportState = {
    range: "week",
  };

  const heatmapState = {
    currentYear: new Date().getFullYear(),
  };

  function toDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(dateKey) {
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return null;
    }

    const [year, month, day] = dateKey.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function addDays(date, offset) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + offset);
    return copy;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildSeedHabits() {
    const today = startOfDay(new Date());
    const dateList = [0, -1, -2, -4, -5, -8, -10];

    return [
      {
        id: 1,
        name: "Morning Run",
        category: "Cardio",
        frequency: "Daily",
        createdAt: toDateKey(today),
        completedDates: dateList.map((offset) => toDateKey(addDays(today, offset))).slice(0, 5),
      },
      {
        id: 2,
        name: "Read 20 Pages",
        category: "Learning",
        frequency: "Daily",
        createdAt: toDateKey(today),
        completedDates: dateList.map((offset) => toDateKey(addDays(today, offset))).slice(0, 4),
      },
      {
        id: 3,
        name: "Drink Water",
        category: "Health",
        frequency: "Daily",
        createdAt: toDateKey(today),
        completedDates: dateList.map((offset) => toDateKey(addDays(today, offset))).slice(0, 3),
      },
    ];
  }

  function createDefaultState() {
    return {
      habits: buildSeedHabits(),
      currentMonth: new Date().getMonth(),
      currentYear: new Date().getFullYear(),
      completionRecords: {},
    };
  }

  function normalizeHabit(habit) {
    if (!habit || typeof habit !== "object") {
      return null;
    }

    const safeName = String(habit.name || "").trim();
    const safeCategory = String(habit.category || "").trim();
    const safeFrequency = String(habit.frequency || "Daily").trim() || "Daily";
    const completedDates = safeArray(habit.completedDates)
      .map((dateKey) => String(dateKey).trim())
      .filter((dateKey) => Boolean(dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      .filter((dateKey, index, array) => array.indexOf(dateKey) === index)
      .sort();

    if (!safeName || !safeCategory) {
      return null;
    }

    return {
      id: Number(habit.id) || Date.now() + Math.random(),
      name: safeName,
      category: safeCategory,
      frequency: safeFrequency,
      createdAt: habit.createdAt || toDateKey(new Date()),
      completedDates,
    };
  }

  function loadState() {
    const defaultState = createDefaultState();

    if (typeof localStorage === "undefined") {
      state.habits = defaultState.habits;
      state.goals = loadGoals();
      state.settings = loadSettings();
      state.currentMonth = defaultState.currentMonth;
      state.currentYear = defaultState.currentYear;
      state.achievementUnlocks = loadAchievementUnlocks();
      return state;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.habits = defaultState.habits;
        state.goals = loadGoals();
        state.settings = loadSettings();
        state.currentMonth = defaultState.currentMonth;
        state.currentYear = defaultState.currentYear;
        state.achievementUnlocks = loadAchievementUnlocks();
        saveState();
        return state;
      }

      const parsed = JSON.parse(raw);
      state.habits = safeArray(parsed.habits)
        .map((habit) => normalizeHabit(habit))
        .filter(Boolean);

      if (!state.habits.length) {
        state.habits = defaultState.habits;
      }

      state.goals = loadGoals();
      state.settings = loadSettings();
      state.currentMonth = Number(parsed.currentMonth) || new Date().getMonth();
      state.currentYear = Number(parsed.currentYear) || new Date().getFullYear();
      state.achievementUnlocks = loadAchievementUnlocks();
      return state;
    } catch (error) {
      state.habits = defaultState.habits;
      state.goals = loadGoals();
      state.settings = loadSettings();
      state.currentMonth = defaultState.currentMonth;
      state.currentYear = defaultState.currentYear;
      state.achievementUnlocks = loadAchievementUnlocks();
      return state;
    }
  }

  function saveState() {
    if (typeof localStorage === "undefined") return;

    try {
      const payload = {
        habits: state.habits,
        currentMonth: state.currentMonth,
        currentYear: state.currentYear,
        completionRecords: buildCompletionRecords(state.habits),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      saveAchievementUnlocks();
      saveGoals();
      saveSettings();
    } catch (error) {
      console.warn("Could not save HabitFlow state.", error);
    }
  }

  function loadSettings() {
    const defaultSettings = { ...DEFAULT_SETTINGS, theme: getStoredTheme() };

    if (typeof localStorage === "undefined") {
      state.settings = defaultSettings;
      return state.settings;
    }

    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!savedSettings) {
        state.settings = defaultSettings;
        return state.settings;
      }

      const parsed = JSON.parse(savedSettings);
      state.settings = { ...defaultSettings, ...(parsed || {}) };
      return state.settings;
    } catch (error) {
      state.settings = defaultSettings;
      return state.settings;
    }
  }

  function saveSettings() {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
      localStorage.setItem(THEME_STORAGE_KEY, state.settings.theme || "light");
    } catch (error) {
      console.warn("Could not save HabitFlow settings.", error);
    }
  }

  function loadGoals() {
    if (typeof localStorage === "undefined") {
      return [];
    }

    try {
      const raw = localStorage.getItem(GOALS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return safeArray(parsed).map((goal) => normalizeGoal(goal)).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function normalizeGoal(goal) {
    if (!goal || typeof goal !== "object") return null;

    const title = String(goal.title || "").trim();
    if (!title) return null;

    return {
      id: Number(goal.id) || Date.now() + Math.random(),
      title,
      description: String(goal.description || "").trim(),
      target: Number(goal.target) || 1,
      current: Number(goal.current) || 0,
      completed: Boolean(goal.completed),
      category: String(goal.category || "General").trim() || "General",
      createdAt: goal.createdAt || toDateKey(new Date()),
    };
  }

  function saveGoals() {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(state.goals));
    } catch (error) {
      console.warn("Could not save HabitFlow goals.", error);
    }
  }

  // Toggle the active light/dark theme and keep localStorage in sync.
  function applyTheme(themeName) {
    const normalizedTheme = themeName === "dark" ? "dark" : "light";
    const root = document.documentElement;
    const body = document.body || document.documentElement;
    const themeTokens = {
      light: {
        "--bg-color": "#f1f5f9",
        "--bg-secondary": "#dfeeff",
        "--card-bg": "#ffffff",
        "--card-bg-soft": "#f8fafc",
        "--surface-strong": "#ffffff",
        "--surface-soft": "#f8fafc",
        "--bg-page": "#f1f5f9",
        "--bg-surface": "#ffffff",
        "--bg-surface-strong": "#ffffff",
        "--bg-surface-soft": "#f8fafc",
        "--bg-page-glow": "rgba(96, 165, 250, 0.18)",
        "--bg-sidebar": "linear-gradient(180deg, #081120 0%, #10254d 100%)",
        "--text-color": "#0f172a",
        "--text-body": "#0f172a",
        "--heading-color": "#081120",
        "--text-primary": "#081120",
        "--secondary-text": "#475569",
        "--text-secondary": "#475569",
        "--muted-text": "#64748b",
        "--text-muted": "#64748b",
        "--border-color": "rgba(15, 23, 42, 0.12)",
        "--border-soft": "rgba(15, 23, 42, 0.12)",
        "--input-bg": "#ffffff",
        "--button-text": "#0f172a",
        "--nav-text": "#e2e8f0",
        "--text-navigation": "#e2e8f0",
        "--nav-hover": "#ffffff",
        "--welcome-panel-bg": "linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #60a5fa 100%)",
        "--welcome-panel-text": "#f8fbff",
        "--welcome-panel-subtle": "rgba(239, 246, 255, 0.86)",
        "--welcome-panel-muted": "#e0f2fe",
        "--welcome-panel-surface": "rgba(255, 255, 255, 0.12)",
      },
      dark: {
        "--bg-color": "#020b17",
        "--bg-secondary": "#071827",
        "--card-bg": "rgba(15, 23, 42, 0.82)",
        "--card-bg-soft": "rgba(30, 41, 59, 0.82)",
        "--surface-strong": "rgba(15, 23, 42, 0.96)",
        "--surface-soft": "rgba(30, 41, 59, 0.9)",
        "--bg-page": "#020b17",
        "--bg-surface": "rgba(15, 23, 42, 0.82)",
        "--bg-surface-strong": "rgba(15, 23, 42, 0.96)",
        "--bg-surface-soft": "rgba(30, 41, 59, 0.9)",
        "--bg-page-glow": "rgba(59, 130, 246, 0.18)",
        "--bg-sidebar": "linear-gradient(180deg, #050d1a 0%, #0d1d36 100%)",
        "--text-color": "#e2e8f0",
        "--text-body": "#e2e8f0",
        "--heading-color": "#f8fbff",
        "--text-primary": "#f8fbff",
        "--secondary-text": "#cbd5e1",
        "--text-secondary": "#cbd5e1",
        "--muted-text": "#94a3b8",
        "--text-muted": "#94a3b8",
        "--border-color": "rgba(148, 163, 184, 0.2)",
        "--border-soft": "rgba(148, 163, 184, 0.2)",
        "--input-bg": "#0b1220",
        "--button-text": "#e2e8f0",
        "--nav-text": "#e2e8f0",
        "--text-navigation": "#e2e8f0",
        "--nav-hover": "#ffffff",
        "--welcome-panel-bg": "linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #60a5fa 100%)",
        "--welcome-panel-text": "#f8fbff",
        "--welcome-panel-subtle": "rgba(239, 246, 255, 0.86)",
        "--welcome-panel-muted": "#e0f2fe",
        "--welcome-panel-surface": "rgba(255, 255, 255, 0.12)",
      },
    };

    Object.entries(themeTokens[normalizedTheme]).forEach(([cssVariable, value]) => {
      root.style.setProperty(cssVariable, value);
    });

    root.classList.toggle("theme-dark", normalizedTheme === "dark");
    body.classList.toggle("theme-dark", normalizedTheme === "dark");
    root.setAttribute("data-theme", normalizedTheme);
    body.setAttribute("data-theme", normalizedTheme);
    root.style.color = normalizedTheme === "dark" ? "#e2e8f0" : "#0f172a";
    body.style.color = normalizedTheme === "dark" ? "#e2e8f0" : "#0f172a";
    document.documentElement.style.colorScheme = normalizedTheme;
    document.body.style.colorScheme = normalizedTheme;

    const toggleButton = document.querySelector("[data-theme-toggle]");
    if (toggleButton) {
      const icon = toggleButton.querySelector(".theme-icon");
      if (icon) {
        icon.textContent = normalizedTheme === "dark" ? "☀️" : "🌙";
      }
      toggleButton.setAttribute("aria-label", normalizedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      toggleButton.title = normalizedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    } catch (error) {
      console.warn("Could not save HabitFlow theme.", error);
    }
  }

  function getStoredTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
      }
    } catch (error) {
      return "light";
    }

    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  }

  function initializeTheme() {
    const theme = getStoredTheme();
    applyTheme(theme);
  }

  function buildCompletionRecords(habits) {
    const records = {};

    habits.forEach((habit) => {
      habit.completedDates.forEach((dateKey) => {
        if (!records[dateKey]) {
          records[dateKey] = {};
        }
        records[dateKey][String(habit.id)] = true;
      });
    });

    return records;
  }

  // Achievement definitions drive the badge collection and unlock logic.
  const achievementDefinitions = [
    {
      id: "first-step",
      title: "First Step",
      description: "Complete your first habit.",
      icon: "🎯",
      type: "checkins",
      goal: 1,
    },
    {
      id: "getting-started",
      title: "Getting Started",
      description: "Complete 5 check-ins.",
      icon: "🚀",
      type: "checkins",
      goal: 5,
    },
    {
      id: "consistency",
      title: "Consistency",
      description: "Complete habits for 3 consecutive days.",
      icon: "🔥",
      type: "consecutive-days",
      goal: 3,
    },
    {
      id: "one-week-champion",
      title: "One Week Champion",
      description: "Maintain a 7-day streak.",
      icon: "🏆",
      type: "consecutive-days",
      goal: 7,
    },
    {
      id: "two-week-champion",
      title: "Two Week Champion",
      description: "Maintain a 14-day streak.",
      icon: "🥇",
      type: "consecutive-days",
      goal: 14,
    },
    {
      id: "monthly-master",
      title: "Monthly Master",
      description: "Maintain a 30-day streak.",
      icon: "👑",
      type: "consecutive-days",
      goal: 30,
    },
    {
      id: "habit-collector",
      title: "Habit Collector",
      description: "Create 5 habits.",
      icon: "📚",
      type: "habits-created",
      goal: 5,
    },
    {
      id: "goal-getter",
      title: "Goal Getter",
      description: "Complete 50 habit check-ins.",
      icon: "💪",
      type: "checkins",
      goal: 50,
    },
    {
      id: "century-club",
      title: "Century Club",
      description: "Complete 100 habit check-ins.",
      icon: "🏅",
      type: "checkins",
      goal: 100,
    },
    {
      id: "perfect-day",
      title: "Perfect Day",
      description: "Complete all scheduled habits for one day.",
      icon: "✨",
      type: "perfect-day",
      goal: 1,
    },
  ];

  function getAchievementDates() {
    const dateSet = new Set();

    state.habits.forEach((habit) => {
      safeArray(habit.completedDates).forEach((dateKey) => dateSet.add(dateKey));
    });

    return [...dateSet].sort();
  }

  function getLongestConsecutiveDayStreak(dateKeys) {
    if (!dateKeys.length) {
      return 0;
    }

    let longest = 1;
    let current = 1;

    for (let index = 1; index < dateKeys.length; index += 1) {
      const previousDate = parseDateKey(dateKeys[index - 1]);
      const currentDate = parseDateKey(dateKeys[index]);

      if (!previousDate || !currentDate) {
        current = 1;
        continue;
      }

      const diffInDays = Math.round((currentDate - previousDate) / 86400000);
      if (diffInDays === 1) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }

  function getCurrentConsecutiveDayStreak(dateKeys) {
    if (!dateKeys.length) {
      return 0;
    }

    const uniqueDates = [...new Set(dateKeys)].sort();
    let streak = 0;
    let cursor = startOfDay(new Date());

    while (uniqueDates.includes(toDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return streak;
  }

  function getPerfectDayCount() {
    if (!state.habits.length) {
      return 0;
    }

    const dateMap = {};

    state.habits.forEach((habit) => {
      safeArray(habit.completedDates).forEach((dateKey) => {
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = 0;
        }
        dateMap[dateKey] += 1;
      });
    });

    return Object.values(dateMap).filter((count) => count >= state.habits.length).length;
  }

  function getAchievementMetrics() {
    const totalCheckins = state.habits.reduce((sum, habit) => sum + safeArray(habit.completedDates).length, 0);
    const totalHabits = state.habits.length;
    const dateKeys = getAchievementDates();
    const longestStreak = getLongestConsecutiveDayStreak(dateKeys);
    const currentStreak = getCurrentConsecutiveDayStreak(dateKeys);
    const perfectDays = getPerfectDayCount();

    return {
      totalCheckins,
      totalHabits,
      dateKeys,
      longestStreak,
      currentStreak,
      perfectDays,
    };
  }

  function getAchievementProgress(achievementId) {
    const metrics = getAchievementMetrics();
    const achievement = achievementDefinitions.find((item) => item.id === achievementId);
    if (!achievement) {
      return { value: 0, goal: 0, progress: 0, isUnlocked: false, label: "0/0" };
    }

    let value = 0;
    if (achievement.type === "checkins") {
      value = metrics.totalCheckins;
    } else if (achievement.type === "consecutive-days") {
      value = achievement.goal === 3 ? metrics.currentStreak : achievement.goal === 7 ? metrics.currentStreak : achievement.goal === 14 ? metrics.currentStreak : metrics.currentStreak;
    } else if (achievement.type === "habits-created") {
      value = metrics.totalHabits;
    } else if (achievement.type === "perfect-day") {
      value = metrics.perfectDays;
    }

    const progress = achievement.goal ? Math.min(100, Math.round((value / achievement.goal) * 100)) : 0;
    const isUnlocked = Boolean(state.achievementUnlocks[achievementId]);

    return {
      value,
      goal: achievement.goal,
      progress,
      isUnlocked,
      label: `${value}/${achievement.goal}`,
      unlockedAt: state.achievementUnlocks[achievementId]?.unlockedAt || null,
    };
  }

  function loadAchievementUnlocks() {
    if (typeof localStorage === "undefined") {
      return {};
    }

    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return Object.entries(parsed).reduce((results, [key, value]) => {
        if (value && typeof value === "object" && value.unlockedAt) {
          results[key] = value;
        }
        return results;
      }, {});
    } catch (error) {
      console.warn("Could not load HabitFlow achievements.", error);
      return {};
    }
  }

  function saveAchievementUnlocks() {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state.achievementUnlocks));
    } catch (error) {
      console.warn("Could not save HabitFlow achievements.", error);
    }
  }

  function showAchievementToast(achievement) {
    const existingToast = document.getElementById("achievement-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "achievement-toast";
    toast.className = "achievement-toast";
    toast.innerHTML = `
      <div class="achievement-toast-icon">${achievement.icon}</div>
      <div>
        <strong>Achievement Unlocked</strong>
        <span>${escapeHtml(achievement.title)}</span>
      </div>
    `;

    document.body.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("is-hidden");
      window.setTimeout(() => toast.remove(), 240);
    }, 2600);
  }

  function syncAchievementUnlocks() {
    const unlocked = { ...state.achievementUnlocks };
    const newlyUnlocked = [];

    achievementDefinitions.forEach((achievement) => {
      const progress = getAchievementProgress(achievement.id);
      if (unlocked[achievement.id]) {
        return;
      }

      if (achievement.type === "checkins" && progress.value >= achievement.goal) {
        unlocked[achievement.id] = { unlockedAt: toDateKey(new Date()) };
        newlyUnlocked.push({ ...achievement, unlockedAt: unlocked[achievement.id].unlockedAt });
      } else if (achievement.type === "habits-created" && progress.value >= achievement.goal) {
        unlocked[achievement.id] = { unlockedAt: toDateKey(new Date()) };
        newlyUnlocked.push({ ...achievement, unlockedAt: unlocked[achievement.id].unlockedAt });
      } else if (achievement.type === "consecutive-days" && progress.value >= achievement.goal) {
        unlocked[achievement.id] = { unlockedAt: toDateKey(new Date()) };
        newlyUnlocked.push({ ...achievement, unlockedAt: unlocked[achievement.id].unlockedAt });
      } else if (achievement.type === "perfect-day" && progress.value >= achievement.goal) {
        unlocked[achievement.id] = { unlockedAt: toDateKey(new Date()) };
        newlyUnlocked.push({ ...achievement, unlockedAt: unlocked[achievement.id].unlockedAt });
      }
    });

    state.achievementUnlocks = unlocked;
    saveAchievementUnlocks();

    newlyUnlocked.forEach((achievement) => {
      showAchievementToast(achievement);
    });

    return state.achievementUnlocks;
  }

  // Build the summary used by the dashboard card and badge modal.
  function getAchievementSummary() {
    const unlockedList = achievementDefinitions.filter((achievement) => Boolean(state.achievementUnlocks[achievement.id]));
    const nextAchievement = achievementDefinitions.find((achievement) => !state.achievementUnlocks[achievement.id]);
    const latestAchievement = [...unlockedList].sort((left, right) => {
      const leftDate = state.achievementUnlocks[left.id]?.unlockedAt || "0000-00-00";
      const rightDate = state.achievementUnlocks[right.id]?.unlockedAt || "0000-00-00";
      return rightDate.localeCompare(leftDate);
    })[0] || null;

    const completionPercent = achievementDefinitions.length
      ? Math.round((unlockedList.length / achievementDefinitions.length) * 100)
      : 0;

    return {
      total: achievementDefinitions.length,
      unlocked: unlockedList.length,
      completionPercent,
      latest: latestAchievement,
      next: nextAchievement || null,
      progress: achievementDefinitions.map((achievement) => ({
        ...achievement,
        progress: getAchievementProgress(achievement.id).progress,
        isUnlocked: Boolean(state.achievementUnlocks[achievement.id]),
      })),
    };
  }

  function renderAchievementSummary() {
    const container = document.getElementById("achievement-summary");
    if (!container) {
      return;
    }

    const summary = getAchievementSummary();
    const latestName = summary.latest ? summary.latest.title : "None yet";
    const nextName = summary.next ? summary.next.title : "All unlocked";
    const progressWidth = summary.completionPercent;

    container.innerHTML = `
      <div class="achievement-summary-grid">
        <div class="achievement-summary-stat">
          <span>Total unlocked</span>
          <strong>${summary.unlocked}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Latest</span>
          <strong>${escapeHtml(latestName)}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Next unlock</span>
          <strong>${escapeHtml(nextName)}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Progress</span>
          <strong>${summary.completionPercent}%</strong>
        </div>
      </div>
      <div class="achievement-progress-tracker" aria-label="Achievement completion progress">
        <span style="width: ${progressWidth}%"></span>
      </div>
    `;
  }

  function renderAchievementModal() {
    const existingModal = document.getElementById("achievement-modal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "achievement-modal";
    modal.className = "achievement-modal";

    const summary = getAchievementSummary();
    modal.innerHTML = `
      <div class="achievement-modal-backdrop" data-close-achievement-modal="true"></div>
      <div class="achievement-modal-panel" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
        <div class="achievement-modal-header">
          <div>
            <p class="achievement-modal-kicker">Progress</p>
            <h3 id="achievement-modal-title">Achievement Collection</h3>
          </div>
          <button type="button" class="achievement-close-btn" data-close-achievement-modal="true" aria-label="Close achievements">×</button>
        </div>

        <div class="achievement-modal-summary">
          <div class="achievement-modal-stat">
            <span>Unlocked</span>
            <strong>${summary.unlocked}/${summary.total}</strong>
          </div>
          <div class="achievement-modal-stat">
            <span>Completion</span>
            <strong>${summary.completionPercent}%</strong>
          </div>
        </div>

        <div class="achievement-grid">
          ${achievementDefinitions
            .map((achievement) => {
              const progress = getAchievementProgress(achievement.id);
              const unlockedAt = state.achievementUnlocks[achievement.id]?.unlockedAt;
              const isUnlocked = Boolean(unlockedAt);

              return `
                <article class="achievement-badge ${isUnlocked ? "is-unlocked" : "is-locked"}">
                  <div class="achievement-badge-icon">${achievement.icon}</div>
                  <div class="achievement-badge-body">
                    <div class="achievement-badge-heading">
                      <h4>${achievement.title}</h4>
                      <span class="achievement-status ${isUnlocked ? "status-unlocked" : "status-locked"}">${isUnlocked ? "Unlocked" : "Locked"}</span>
                    </div>
                    <p>${achievement.description}</p>
                    <div class="achievement-badge-meta">
                      <span>${isUnlocked ? `Unlocked ${unlockedAt}` : `Progress ${progress.progress}%`}</span>
                    </div>
                    <div class="achievement-mini-progress">
                      <span style="width: ${progress.progress}%"></span>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.closeAchievementModal === "true") {
        modal.remove();
      }
    });
  }

  function isCompletedOnDate(habit, dateKey) {
    return Array.isArray(habit.completedDates) && habit.completedDates.includes(dateKey);
  }

  function getCurrentDateKey() {
    return toDateKey(startOfDay(new Date()));
  }

  function getHabitStreaks(habit) {
    const uniqueDates = safeArray(habit.completedDates)
      .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      .filter((dateKey, index, array) => array.indexOf(dateKey) === index)
      .sort();

    if (!uniqueDates.length) {
      return { current: 0, longest: 0 };
    }

    let longest = 1;
    let current = 1;

    for (let index = 1; index < uniqueDates.length; index += 1) {
      const previousDate = parseDateKey(uniqueDates[index - 1]);
      const currentDate = parseDateKey(uniqueDates[index]);

      if (!previousDate || !currentDate) {
        continue;
      }

      const difference = Math.round((currentDate - previousDate) / 86400000);

      if (difference === 1) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    const datesSet = new Set(uniqueDates);
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    if (!datesSet.has(toDateKey(cursor))) {
      cursor = addDays(cursor, -1);
    }

    while (datesSet.has(toDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return {
      current: streak,
      longest,
    };
  }

  function getProgressSummary() {
    const total = state.habits.length;
    const completedToday = state.habits.filter((habit) => isCompletedOnDate(habit, getCurrentDateKey())).length;
    const remaining = Math.max(total - completedToday, 0);
    const percentage = total ? Math.round((completedToday / total) * 100) : 0;

    return {
      total,
      completedToday,
      remaining,
      percentage,
    };
  }

  function buildWeekData() {
    const days = [];
    const today = startOfDay(new Date());

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset);
      const dayKey = toDateKey(date);
      const completedCount = state.habits.filter((habit) => isCompletedOnDate(habit, dayKey)).length;
      const percentage = state.habits.length ? Math.round((completedCount / state.habits.length) * 100) : 0;

      days.push({
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        dateKey: dayKey,
        completedCount,
        percentage,
      });
    }

    return days;
  }

  function buildCalendarMonth() {
    const firstDayOfMonth = new Date(state.currentYear, state.currentMonth, 1);
    const firstWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
    const startDate = addDays(firstDayOfMonth, -firstWeekDay);
    const totalCells = 42;

    const days = [];

    for (let index = 0; index < totalCells; index += 1) {
      const currentDate = addDays(startDate, index);
      const key = toDateKey(currentDate);
      const inCurrentMonth = currentDate.getMonth() === state.currentMonth;
      const isToday = key === getCurrentDateKey();
      const completions = state.habits.filter((habit) => isCompletedOnDate(habit, key)).length;

      days.push({
        date: currentDate,
        key,
        inCurrentMonth,
        isToday,
        completions,
      });
    }

    return {
      monthLabel: firstDayOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      days,
    };
  }

  function renderProgressSummary() {
    const container = document.getElementById("today-progress-summary");
    if (!container) return;

    const summary = getProgressSummary();

    container.innerHTML = `
      <div class="progress-stat">
        <span class="stat-label">Total Habits</span>
        <strong class="stat-value" data-progress="total">${summary.total}</strong>
      </div>
      <div class="progress-stat">
        <span class="stat-label">Completed</span>
        <strong class="stat-value" data-progress="completed">${summary.completedToday}</strong>
      </div>
      <div class="progress-stat">
        <span class="stat-label">Remaining</span>
        <strong class="stat-value" data-progress="remaining">${summary.remaining}</strong>
      </div>
      <div class="progress-stat">
        <span class="stat-label">Daily Completion</span>
        <strong class="stat-value" data-progress="percent">${summary.percentage}%</strong>
      </div>
    `;
  }

  function renderHabitCards() {
    const habitList = document.getElementById("habit-list");
    const emptyState = document.getElementById("empty-state");

    if (!habitList) return;

    if (!state.habits.length) {
      habitList.innerHTML = "";
      if (emptyState) {
        emptyState.style.display = "block";
      }
      return;
    }

    if (emptyState) {
      emptyState.style.display = "none";
    }

    habitList.innerHTML = state.habits
      .map((habit) => {
        const streak = getHabitStreaks(habit);
        const todayKey = getCurrentDateKey();
        const isDoneToday = isCompletedOnDate(habit, todayKey);
        const badgeClass = isDoneToday ? "completed" : streak.current > 0 ? "in-progress" : "pending";
        const badgeText = isDoneToday ? "Done" : streak.current > 0 ? `Streak ${streak.current}` : "Pending";

        return `
          <article class="habit-card" data-habit-id="${habit.id}">
            <div class="habit-card-header">
              <div>
                <h3>${escapeHtml(habit.name)}</h3>
                <p>${escapeHtml(habit.category)}</p>
              </div>
              <button
                type="button"
                class="habit-status ${badgeClass}"
                data-action="toggle-complete"
                data-id="${habit.id}"
              >${badgeText}</button>
            </div>
            <div class="habit-meta">
              <span>${streak.current} day streak</span>
              <span>${escapeHtml(habit.frequency)}</span>
            </div>
            <div class="habit-actions" style="display:flex; gap:10px; margin-top:16px;">
              <button type="button" data-action="edit" data-id="${habit.id}" style="flex:1; border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; border-radius:10px; padding:8px 10px; cursor:pointer; font-weight:600;">Edit</button>
              <button type="button" data-action="delete" data-id="${habit.id}" style="flex:1; border:1px solid #fee2e2; background:#fff1f2; color:#b91c1c; border-radius:10px; padding:8px 10px; cursor:pointer; font-weight:600;">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderDailyChecklist() {
    const checklist = document.getElementById("daily-checklist");
    const checkedCountEl = document.getElementById("daily-checked-count");
    const remainingCountEl = document.getElementById("daily-remaining-count");
    if (!checklist) return;

    const todayKey = getCurrentDateKey();
    const totalHabits = state.habits.length;
    const completedToday = state.habits.filter((habit) => isCompletedOnDate(habit, todayKey)).length;
    const remainingToday = Math.max(totalHabits - completedToday, 0);

    if (checkedCountEl) checkedCountEl.textContent = String(completedToday);
    if (remainingCountEl) remainingCountEl.textContent = String(remainingToday);

    if (!state.habits.length) {
      checklist.innerHTML = '<div class="daily-checklist-empty">No habits yet. Add one to start your daily checklist.</div>';
      return;
    }

    checklist.innerHTML = state.habits
      .map((habit) => {
        const isDone = isCompletedOnDate(habit, todayKey);
        const title = `${habit.name} ${isDone ? "completed" : "not completed"}`;

        return `
          <div class="daily-checklist-item ${isDone ? "is-complete" : ""}" data-habit-id="${habit.id}">
            <div class="daily-checklist-copy">
              <span class="daily-checklist-name">${escapeHtml(habit.name)}</span>
              <span class="daily-checklist-category">${escapeHtml(habit.category)}</span>
            </div>
            <button
              type="button"
              class="daily-checklist-toggle ${isDone ? "checked" : ""}"
              data-action="toggle-complete"
              data-id="${habit.id}"
              aria-label="${title}"
              aria-pressed="${String(isDone)}"
            >
              <span class="check-mark">✓</span>
            </button>
          </div>
        `;
      })
      .join("");
  }

  function renderWeeklyProgress() {
    const weeklyContainer = document.getElementById("weekly-progress");
    if (!weeklyContainer) return;

    const weekData = buildWeekData();

    weeklyContainer.innerHTML = weekData
      .map(
        (day) => `
          <div class="week-day">
            <span class="day-name">${day.label}</span>
            <span class="day-bar" style="height: ${Math.max(18, day.percentage)}%;"></span>
          </div>
        `
      )
      .join("");
  }

  function renderCalendar() {
    const calendarContainer = document.getElementById("calendar-content");
    if (!calendarContainer) return;

    const calendarData = buildCalendarMonth();
    calendarContainer.innerHTML = `
      <div class="calendar-toolbar">
        <div class="calendar-nav-group">
          <button type="button" data-calendar-nav="prev" class="calendar-nav-btn">Prev</button>
          <button type="button" data-calendar-nav="next" class="calendar-nav-btn">Next</button>
        </div>
      </div>
      <div id="calendar-month-label" class="calendar-month-label">${calendarData.monthLabel}</div>
      <div id="calendar-grid" class="calendar-grid">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          .map((day) => `<div class="calendar-weekday">${day}</div>`)
          .join("")}
        ${calendarData.days
          .map((day) => {
            const activeMonth = day.inCurrentMonth ? "calendar-day current-month" : "calendar-day other-month";
            const todayClass = day.isToday ? "calendar-day today" : "calendar-day";
            const dayClass = `${activeMonth} ${todayClass}`;
            const completionMarkup = day.completions > 0 ? `<span class="calendar-day-status">${day.completions} done</span>` : "";
            return `
              <div class="${dayClass}">
                <span class="calendar-day-number">${day.date.getDate()}</span>
                ${completionMarkup}
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    const prevButton = document.querySelector('[data-calendar-nav="prev"]');
    const nextButton = document.querySelector('[data-calendar-nav="next"]');

    if (prevButton) {
      prevButton.onclick = () => {
        state.currentMonth -= 1;
        if (state.currentMonth < 0) {
          state.currentMonth = 11;
          state.currentYear -= 1;
        }
        renderCalendar();
      };
    }

    if (nextButton) {
      nextButton.onclick = () => {
        state.currentMonth += 1;
        if (state.currentMonth > 11) {
          state.currentMonth = 0;
          state.currentYear += 1;
        }
        renderCalendar();
      };
    }
  }

  function openHabitModal(habitToEdit = null) {
    const previousModal = document.getElementById("habit-modal");
    if (previousModal) {
      previousModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "habit-modal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(15, 23, 42, 0.4)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "1000";
    modal.style.padding = "20px";

    const isDarkTheme = document.body.classList.contains("theme-dark");
    const formId = habitToEdit ? `edit-habit-${habitToEdit.id}` : "create-habit-form";
    const title = habitToEdit ? "Edit Habit" : "Add New Habit";

    modal.innerHTML = `
      <div style="width:min(100%, 480px); background:${isDarkTheme ? "#0f172a" : "#ffffff"}; border-radius:20px; box-shadow:0 24px 60px rgba(15, 23, 42, 0.18); padding:24px; border:1px solid ${isDarkTheme ? "#1e293b" : "#e2e8f0"}; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"};">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px;">
          <h3 style="margin:0; font-size:1.5rem; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"}; letter-spacing:-0.04em;">${title}</h3>
          <button type="button" data-close-modal="true" style="border:none; background:${isDarkTheme ? "#1e293b" : "#eff6ff"}; color:${isDarkTheme ? "#dbeafe" : "#1d4ed8"}; width:36px; height:36px; border-radius:10px; font-size:1.2rem; cursor:pointer;">×</button>
        </div>
        <form id="${formId}" novalidate>
          <div style="display:flex; flex-direction:column; gap:14px;">
            <label style="display:flex; flex-direction:column; gap:8px; font-weight:600; color:${isDarkTheme ? "#cbd5e1" : "#334155"};">
              Habit Name
              <input name="name" type="text" value="${habitToEdit ? escapeHtml(habitToEdit.name) : ""}" required style="padding:12px 14px; border:1px solid ${isDarkTheme ? "#334155" : "#cbd5e1"}; border-radius:12px; font:inherit; background:${isDarkTheme ? "#0b1220" : "#ffffff"}; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"};" />
            </label>
            <label style="display:flex; flex-direction:column; gap:8px; font-weight:600; color:${isDarkTheme ? "#cbd5e1" : "#334155"};">
              Category
              <input name="category" type="text" value="${habitToEdit ? escapeHtml(habitToEdit.category) : ""}" required style="padding:12px 14px; border:1px solid ${isDarkTheme ? "#334155" : "#cbd5e1"}; border-radius:12px; font:inherit; background:${isDarkTheme ? "#0b1220" : "#ffffff"}; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"};" />
            </label>
            <label style="display:flex; flex-direction:column; gap:8px; font-weight:600; color:${isDarkTheme ? "#cbd5e1" : "#334155"};">
              Frequency
              <select name="frequency" required style="padding:12px 14px; border:1px solid ${isDarkTheme ? "#334155" : "#cbd5e1"}; border-radius:12px; font:inherit; background:${isDarkTheme ? "#0b1220" : "#ffffff"}; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"};">
                <option value="Daily" ${habitToEdit && habitToEdit.frequency === "Daily" ? "selected" : ""}>Daily</option>
                <option value="Weekly" ${habitToEdit && habitToEdit.frequency === "Weekly" ? "selected" : ""}>Weekly</option>
                <option value="3x a Week" ${habitToEdit && habitToEdit.frequency === "3x a Week" ? "selected" : ""}>3x a Week</option>
                <option value="Monthly" ${habitToEdit && habitToEdit.frequency === "Monthly" ? "selected" : ""}>Monthly</option>
              </select>
            </label>
            <div id="habit-form-error" style="color:#b91c1c; min-height:18px; font-size:0.85rem; font-weight:600;"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
              <button type="button" data-close-modal="true" style="background:${isDarkTheme ? "#1e293b" : "#e2e8f0"}; color:${isDarkTheme ? "#e2e8f0" : "#0f172a"}; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer;">Cancel</button>
              <button type="submit" style="background:linear-gradient(135deg, #2563eb, #3b82f6); color:#ffffff; border:none; border-radius:10px; padding:10px 18px; font-weight:700; cursor:pointer;">Save Habit</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const category = String(formData.get("category") || "").trim();
      const frequency = String(formData.get("frequency") || "Daily").trim();
      const errorEl = document.getElementById("habit-form-error");

      if (!name || name.length < 2) {
        if (errorEl) errorEl.textContent = "Habit name must be at least 2 characters.";
        return;
      }

      if (!category || category.length < 2) {
        if (errorEl) errorEl.textContent = "Category is required.";
        return;
      }

      if (!frequency) {
        if (errorEl) errorEl.textContent = "Please select a frequency.";
        return;
      }

      if (habitToEdit) {
        const existingHabit = state.habits.find((habit) => habit.id === habitToEdit.id);
        if (existingHabit) {
          existingHabit.name = name;
          existingHabit.category = category;
          existingHabit.frequency = frequency;
        }
      } else {
        const newHabit = normalizeHabit({
          id: Date.now(),
          name,
          category,
          frequency,
          createdAt: toDateKey(new Date()),
          completedDates: [],
        });

        if (newHabit) {
          state.habits.push(newHabit);
        }
      }

      saveState();
      renderDashboard();
      modal.remove();
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.getAttribute("data-close-modal") === "true") {
        modal.remove();
      }
    });
  }

  function handleCardAction(event) {
    const target = event.target.closest("button");
    if (!target) return;

    const action = target.dataset.action;
    const habitId = Number(target.dataset.id);
    if (!action || Number.isNaN(habitId)) return;

    const habit = state.habits.find((item) => item.id === habitId);
    if (!habit) return;

    if (action === "toggle-complete") {
      const todayKey = getCurrentDateKey();
      const completed = isCompletedOnDate(habit, todayKey);

      if (completed) {
        habit.completedDates = habit.completedDates.filter((dateKey) => dateKey !== todayKey);
      } else {
        habit.completedDates = Array.from(new Set([...habit.completedDates, todayKey])).sort();
      }

      saveState();
      renderDashboard();
      return;
    }

    if (action === "edit") {
      openHabitModal(habit);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete "${habit.name}"?`);
      if (!confirmed) return;

      state.habits = state.habits.filter((item) => item.id !== habitId);
      saveState();
      renderDashboard();
    }
  }

  function getWeekStart(date) {
    const copy = startOfDay(date);
    const dayIndex = (copy.getDay() + 6) % 7;
    return addDays(copy, -dayIndex);
  }

  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function getRangeFromDate(date, type) {
    const baseDate = startOfDay(date);

    if (type === "month") {
      const start = getMonthStart(baseDate);
      const end = getMonthEnd(baseDate);
      return { start, end };
    }

    const start = getWeekStart(baseDate);
    return { start, end: addDays(start, 6) };
  }

  function buildPeriodSummary(referenceDate, type) {
    const range = getRangeFromDate(referenceDate, type);
    const allDates = [];
    let cursor = new Date(range.start);
    while (cursor <= range.end) {
      allDates.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }

    const totalHabits = state.habits.length;
    const totalPossible = totalHabits * allDates.length;
    const habitTotals = {};

    state.habits.forEach((habit) => {
      habitTotals[habit.id] = 0;
    });

    let completedTotal = 0;
    allDates.forEach((date) => {
      const dateKey = toDateKey(date);
      state.habits.forEach((habit) => {
        if (isCompletedOnDate(habit, dateKey)) {
          habitTotals[habit.id] += 1;
          completedTotal += 1;
        }
      });
    });

    const pendingTotal = Math.max(totalPossible - completedTotal, 0);
    const completionRate = totalPossible ? Math.round((completedTotal / totalPossible) * 100) : 0;
    const habitEntries = state.habits.map((habit) => ({
      name: habit.name,
      count: habitTotals[habit.id] || 0,
    }));

    const bestHabit = habitEntries.length ? [...habitEntries].sort((a, b) => b.count - a.count)[0] : null;
    const leastHabit = habitEntries.length ? [...habitEntries].sort((a, b) => a.count - b.count)[0] : null;
    const currentStreak = state.habits.reduce((highest, habit) => Math.max(highest, getHabitStreaks(habit).current), 0);
    const longestStreak = state.habits.reduce((highest, habit) => Math.max(highest, getHabitStreaks(habit).longest), 0);

    const previousRangeEnd = addDays(new Date(range.start), -1);
    const previousRangeStart = type === "month"
      ? new Date(
          previousRangeEnd.getFullYear(),
          previousRangeEnd.getMonth(),
          1
        )
      : addDays(previousRangeEnd, -(6));
    const previousRangeEndDate = previousRangeEnd;
    const previousDates = [];
    let previousCursor = new Date(previousRangeStart);
    while (previousCursor <= previousRangeEndDate) {
      previousDates.push(new Date(previousCursor));
      previousCursor = addDays(previousCursor, 1);
    }

    let previousCompleted = 0;
    previousDates.forEach((date) => {
      const dateKey = toDateKey(date);
      state.habits.forEach((habit) => {
        if (isCompletedOnDate(habit, dateKey)) {
          previousCompleted += 1;
        }
      });
    });

    const previousTotalPossible = state.habits.length * previousDates.length;
    const previousRate = previousTotalPossible ? Math.round((previousCompleted / previousTotalPossible) * 100) : 0;
    const delta = previousTotalPossible ? Math.round(completionRate - previousRate) : 0;

    return {
      start: range.start,
      end: range.end,
      completedTotal,
      pendingTotal,
      completionRate,
      bestHabit,
      leastHabit,
      currentStreak,
      longestStreak,
      delta,
      previousRate,
      dailyStats: allDates.map((date) => {
        const dateKey = toDateKey(date);
        const value = state.habits.filter((habit) => isCompletedOnDate(habit, dateKey)).length;
        return {
          label: date.toLocaleDateString(undefined, { weekday: type === "week" ? "short" : "short" }),
          value,
          fullDate: dateKey,
          percentage: totalHabits ? Math.round((value / totalHabits) * 100) : 0,
        };
      }),
    };
  }

  function renderMiniBars(containerId, values, colorMode = "primary") {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!values.length) {
      container.innerHTML = '<div class="chart-empty">No data</div>';
      return;
    }

    const maxValue = Math.max(...values.map((item) => item.value || 0), 1);
    const fillColor = colorMode === "secondary" ? "var(--primary-500)" : "linear-gradient(180deg, #93c5fd 0%, #2563eb 100%)";

    container.innerHTML = values
      .map((item) => {
        const height = maxValue ? Math.max(12, (item.value / maxValue) * 100) : 0;
        return `
          <div class="chart-bar-item" title="${item.fullDate || item.label}: ${item.value} completed">
            <span class="chart-bar" style="height: ${height}%; background:${fillColor};"></span>
            <small>${item.label}</small>
          </div>
        `;
      })
      .join("");
  }

  function updateReportSummary() {
    const reportDateInput = document.getElementById("report-date-filter");
    const selectedDate = reportDateInput && reportDateInput.value ? parseDateKey(reportDateInput.value) : new Date();
    const weekSummary = buildPeriodSummary(selectedDate || new Date(), "week");
    const monthSummary = buildPeriodSummary(selectedDate || new Date(), "month");
    const activeRange = reportState.range === "month" ? "month" : "week";

    const weekRateEl = document.getElementById("weekly-completion-rate");
    const monthRateEl = document.getElementById("monthly-completion-rate");
    const weeklyComparisonEl = document.getElementById("weekly-comparison");
    const monthlyComparisonEl = document.getElementById("monthly-comparison");
    const completedTotalEl = document.getElementById("report-total-completed");
    const pendingTotalEl = document.getElementById("report-total-pending");
    const bestHabitEl = document.getElementById("report-best-habit");
    const bestHabitMetaEl = document.getElementById("report-best-habit-meta");
    const leastHabitEl = document.getElementById("report-least-habit");
    const leastHabitMetaEl = document.getElementById("report-least-habit-meta");
    const currentStreakEl = document.getElementById("report-current-streak");
    const longestStreakEl = document.getElementById("report-longest-streak");
    const weeklyChartLabel = document.getElementById("weekly-chart-label");
    const monthlyChartLabel = document.getElementById("monthly-chart-label");

    if (weekRateEl) weekRateEl.textContent = `${weekSummary.completionRate}%`;
    if (monthRateEl) monthRateEl.textContent = `${monthSummary.completionRate}%`;
    if (weeklyComparisonEl) weeklyComparisonEl.textContent = `${weekSummary.delta >= 0 ? "+" : ""}${weekSummary.delta}% vs previous week`;
    if (monthlyComparisonEl) monthlyComparisonEl.textContent = `${monthSummary.delta >= 0 ? "+" : ""}${monthSummary.delta}% vs previous month`;

    const activeSummary = activeRange === "month" ? monthSummary : weekSummary;
    if (completedTotalEl) completedTotalEl.textContent = String(activeSummary.completedTotal);
    if (pendingTotalEl) pendingTotalEl.textContent = `${activeSummary.pendingTotal} pending`;
    if (bestHabitEl) bestHabitEl.textContent = activeSummary.bestHabit ? activeSummary.bestHabit.name : "N/A";
    if (bestHabitMetaEl) bestHabitMetaEl.textContent = activeSummary.bestHabit ? `${activeSummary.bestHabit.count} check-ins` : "0 check-ins";
    if (leastHabitEl) leastHabitEl.textContent = activeSummary.leastHabit ? activeSummary.leastHabit.name : "N/A";
    if (leastHabitMetaEl) leastHabitMetaEl.textContent = activeSummary.leastHabit ? `${activeSummary.leastHabit.count} check-ins` : "0 check-ins";
    if (currentStreakEl) currentStreakEl.textContent = `${activeSummary.currentStreak}d`;
    if (longestStreakEl) longestStreakEl.textContent = `Longest: ${activeSummary.longestStreak}d`;
    if (weeklyChartLabel) weeklyChartLabel.textContent = `${weekSummary.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${weekSummary.end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    if (monthlyChartLabel) monthlyChartLabel.textContent = `${monthSummary.start.toLocaleDateString(undefined, { month: "short" })} ${monthSummary.start.getFullYear()}`;

    renderMiniBars("weekly-chart", weekSummary.dailyStats, "primary");

    const monthBuckets = [];
    let monthCursor = new Date(monthSummary.start);
    while (monthCursor <= monthSummary.end) {
      const bucketStart = new Date(monthCursor);
      const bucketEnd = addDays(bucketStart, 6);
      const bucketDays = [];
      let bucketCursor = new Date(bucketStart);
      while (bucketCursor <= bucketEnd && bucketCursor <= monthSummary.end) {
        bucketDays.push(bucketCursor);
        bucketCursor = addDays(bucketCursor, 1);
      }

      const totalBucketValue = bucketDays.reduce((sum, date) => {
        const dateKey = toDateKey(date);
        const completions = state.habits.filter((habit) => isCompletedOnDate(habit, dateKey)).length;
        return sum + completions;
      }, 0);

      monthBuckets.push({
        label: bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: totalBucketValue,
        fullDate: `${toDateKey(bucketStart)} → ${toDateKey(bucketEnd)}`,
      });

      monthCursor = addDays(bucketEnd, 1);
    }

    renderMiniBars("monthly-chart", monthBuckets, "secondary");
  }

  function attachReportControls() {
    const filterInput = document.getElementById("report-date-filter");
    if (filterInput) {
      filterInput.value = toDateKey(new Date());
      filterInput.addEventListener("change", () => {
        updateReportSummary();
      });
    }

    document.querySelectorAll(".report-range-btn").forEach((button) => {
      button.addEventListener("click", () => {
        reportState.range = button.dataset.reportRange || "week";
        document.querySelectorAll(".report-range-btn").forEach((option) => {
          option.classList.toggle("active", option === button);
        });
        updateReportSummary();
      });
    });
  }

  function getHeatmapYearStart(year) {
    return new Date(year, 0, 1);
  }

  function getHeatmapYearEnd(year) {
    return new Date(year, 11, 31);
  }

  function getHeatmapWeeks(year) {
    const start = getHeatmapYearStart(year);
    const end = getHeatmapYearEnd(year);
    const firstSunday = new Date(start);
    firstSunday.setDate(start.getDate() - start.getDay());
    const lastSaturday = new Date(end);
    lastSaturday.setDate(end.getDate() + (6 - end.getDay()));

    const weeks = [];
    let cursor = new Date(firstSunday);

    while (cursor <= lastSaturday) {
      const week = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const current = addDays(cursor, dayIndex);
        const dateKey = toDateKey(current);
        const completedCount = state.habits.reduce((count, habit) => count + (isCompletedOnDate(habit, dateKey) ? 1 : 0), 0);
        week.push({
          date: current,
          dateKey,
          completedCount,
          inYear: current.getFullYear() === year,
        });
      }
      weeks.push(week);
      cursor = addDays(cursor, 7);
    }

    return weeks;
  }

  function getHeatmapIntensity(value) {
    if (!value) return "var(--heatmap-empty)";
    if (value === 1) return "var(--heatmap-level-1)";
    if (value === 2) return "var(--heatmap-level-2)";
    if (value === 3) return "var(--heatmap-level-3)";
    if (value >= 4) return "var(--heatmap-level-4)";
    return "var(--heatmap-empty)";
  }

  function renderHeatmap() {
    const container = document.getElementById("habit-heatmap") || document.getElementById("statistics-heatmap");
    const yearLabel = document.getElementById("heatmap-year-label") || document.getElementById("statistics-heatmap-year-label");
    const activeDaysEl = document.getElementById("heatmap-active-days") || document.getElementById("statistics-heatmap-active-days");
    const checkInsEl = document.getElementById("heatmap-total-checkins") || document.getElementById("statistics-heatmap-total-checkins");

    if (!container) return;

    const weeks = getHeatmapWeeks(heatmapState.currentYear);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthLabels = weeks.map((week, index) => {
      const monthIndex = week[0].date.getMonth();
      const label = index === 0 || week[0].date.getDate() <= 7 ? monthNames[monthIndex] : "";
      return `<span class="heatmap-month-label">${label}</span>`;
    }).join("");

    const activeDays = state.habits.length
      ? new Set(
          Object.keys(
            state.habits.reduce((records, habit) => {
              habit.completedDates.forEach((dateKey) => {
                records[dateKey] = true;
              });
              return records;
            }, {})
          )
        ).size
      : 0;

    const totalCheckIns = state.habits.reduce((sum, habit) => sum + habit.completedDates.length, 0);

    if (yearLabel) yearLabel.textContent = String(heatmapState.currentYear);
    if (activeDaysEl) activeDaysEl.textContent = `${activeDays}`;
    if (checkInsEl) checkInsEl.textContent = `${totalCheckIns}`;

    container.innerHTML = `
      <div class="heatmap-month-row" style="grid-template-columns: repeat(${weeks.length}, minmax(0, 1fr));">${monthLabels}</div>
      <div class="heatmap-week-grid" style="grid-template-columns: repeat(${weeks.length}, minmax(0, 1fr));">
        ${weeks
          .map((week) => `
            <div class="heatmap-week">
              ${week
                .map((day) => `
                  <div
                    class="heatmap-day ${day.inYear ? "in-year" : "out-year"}"
                    data-date="${day.dateKey}"
                    data-heatmap-day="true"
                    title="${day.dateKey}: ${day.completedCount} completed habit${day.completedCount === 1 ? "" : "s"}"
                    style="background: ${getHeatmapIntensity(day.completedCount)};"
                  ></div>
                `)
                .join("")}
            </div>
          `)
          .join("")}
      </div>
    `;

    const dayButtons = container.querySelectorAll("[data-heatmap-day='true']");
    dayButtons.forEach((button) => {
      button.addEventListener("click", () => {
        showHeatmapDetails(button.dataset.date);
      });
    });
  }

  function showHeatmapDetails(dateKey) {
    if (!dateKey) return;

    const completedHabits = state.habits.filter((habit) => isCompletedOnDate(habit, dateKey));
    const summaryText = completedHabits.length
      ? completedHabits.map((habit) => habit.name).join(", ")
      : "No habit completions recorded";

    const modal = document.getElementById("heatmap-date-modal");
    if (modal) modal.remove();

    const detailModal = document.createElement("div");
    detailModal.id = "heatmap-date-modal";
    detailModal.className = "achievement-modal";
    detailModal.innerHTML = `
      <div class="achievement-modal-backdrop" data-close-heatmap-detail="true"></div>
      <div class="achievement-modal-panel" role="dialog" aria-modal="true" aria-labelledby="heatmap-detail-title">
        <div class="achievement-modal-header">
          <div>
            <p class="achievement-modal-kicker">Activity</p>
            <h3 id="heatmap-detail-title">${new Date(dateKey).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</h3>
          </div>
          <button type="button" class="achievement-close-btn" data-close-heatmap-detail="true" aria-label="Close date details">×</button>
        </div>
        <div class="achievement-modal-summary">
          <div class="achievement-modal-stat">
            <span>Completed</span>
            <strong>${completedHabits.length}</strong>
          </div>
          <div class="achievement-modal-stat">
            <span>Habits</span>
            <strong>${state.habits.length}</strong>
          </div>
        </div>
        <div class="achievement-grid">
          ${completedHabits.length
            ? completedHabits.map((habit) => `
                <article class="achievement-badge is-unlocked">
                  <div class="achievement-badge-icon">✓</div>
                  <div class="achievement-badge-body">
                    <div class="achievement-badge-heading">
                      <h4>${escapeHtml(habit.name)}</h4>
                      <span class="achievement-status status-unlocked">Done</span>
                    </div>
                    <p>${escapeHtml(habit.category)}</p>
                  </div>
                </article>
              `).join("")
            : `
              <article class="achievement-badge is-locked">
                <div class="achievement-badge-icon">—</div>
                <div class="achievement-badge-body">
                  <div class="achievement-badge-heading">
                    <h4>No habits completed</h4>
                    <span class="achievement-status status-locked">Idle</span>
                  </div>
                  <p>${escapeHtml(summaryText)}</p>
                </div>
              </article>
            `}
        </div>
      </div>
    `;

    document.body.appendChild(detailModal);
    detailModal.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && (event.target.dataset.closeHeatmapDetail === "true" || event.target.classList.contains("achievement-modal-backdrop"))) {
        detailModal.remove();
      }
    });
  }

  function attachHeatmapControls() {
    const prevButton = document.querySelector("[data-heatmap-year='prev']");
    const nextButton = document.querySelector("[data-heatmap-year='next']");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        heatmapState.currentYear -= 1;
        renderHeatmap();
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        heatmapState.currentYear += 1;
        renderHeatmap();
      });
    }
  }

  // Render the achievements library and current progress summary for the dedicated section.
  function renderAchievementLibrary() {
    const library = document.getElementById("achievement-library");
    if (!library) return;

    syncAchievementUnlocks();
    const unlocked = achievementDefinitions.filter((achievement) => Boolean(state.achievementUnlocks[achievement.id]));
    const locked = achievementDefinitions.filter((achievement) => !state.achievementUnlocks[achievement.id]);

    library.innerHTML = `
      <div class="achievement-summary-grid">
        <div class="achievement-summary-stat">
          <span>Unlocked</span>
          <strong>${unlocked.length}/${achievementDefinitions.length}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Completion</span>
          <strong>${Math.round((unlocked.length / achievementDefinitions.length) * 100)}%</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Current streak</span>
          <strong>${state.habits.reduce((highest, habit) => Math.max(highest, getHabitStreaks(habit).current), 0)}d</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Check-ins</span>
          <strong>${state.habits.reduce((sum, habit) => sum + habit.completedDates.length, 0)}</strong>
        </div>
      </div>

      <div class="achievement-grid">
        ${achievementDefinitions
          .map((achievement) => {
            const progress = getAchievementProgress(achievement.id);
            const unlockedAt = state.achievementUnlocks[achievement.id]?.unlockedAt;
            const isUnlocked = Boolean(unlockedAt);

            return `
              <article class="achievement-badge ${isUnlocked ? "is-unlocked" : "is-locked"}">
                <div class="achievement-badge-icon">${achievement.icon}</div>
                <div class="achievement-badge-body">
                  <div class="achievement-badge-heading">
                    <h4>${achievement.title}</h4>
                    <span class="achievement-status ${isUnlocked ? "status-unlocked" : "status-locked"}">${isUnlocked ? "Unlocked" : "Locked"}</span>
                  </div>
                  <p>${achievement.description}</p>
                  <div class="achievement-badge-meta">
                    <span>${isUnlocked ? `Unlocked ${unlockedAt}` : `Unlock condition: ${achievement.goal} ${achievement.type}`}</span>
                  </div>
                  <div class="achievement-mini-progress">
                    <span style="width: ${progress.progress}%"></span>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  // Goals are stored locally so users can keep milestones without affecting the main habit data.
  function renderGoalsView() {
    const goalsList = document.getElementById("goals-list");
    const goalsSummary = document.getElementById("goals-summary");
    if (!goalsList || !goalsSummary) return;

    const totalGoals = state.goals.length;
    const completedGoals = state.goals.filter((goal) => goal.completed).length;
    const pendingGoals = totalGoals - completedGoals;

    goalsSummary.innerHTML = `
      <div class="achievement-summary-grid">
        <div class="achievement-summary-stat">
          <span>Total goals</span>
          <strong>${totalGoals}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Completed</span>
          <strong>${completedGoals}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Pending</span>
          <strong>${pendingGoals}</strong>
        </div>
        <div class="achievement-summary-stat">
          <span>Progress</span>
          <strong>${totalGoals ? Math.round((completedGoals / totalGoals) * 100) : 0}%</strong>
        </div>
      </div>
    `;

    if (!state.goals.length) {
      goalsList.innerHTML = '<div class="daily-checklist-empty">No goals yet. Add your first goal to start tracking progress.</div>';
      return;
    }

    goalsList.innerHTML = state.goals
      .map((goal) => {
        const progress = Math.min(100, Math.max(0, Math.round((goal.current / Math.max(goal.target, 1)) * 100)));
        return `
          <article class="goal-item">
            <div class="goal-header">
              <div>
                <h3>${escapeHtml(goal.title)}</h3>
                <p>${escapeHtml(goal.category)}</p>
              </div>
              <span class="goal-status ${goal.completed ? "completed" : "pending"}">${goal.completed ? "Completed" : "Pending"}</span>
            </div>
            <p class="goal-description">${escapeHtml(goal.description || "No description provided.")}</p>
            <div class="goal-progress-row">
              <span>${goal.current}/${goal.target}</span>
              <strong>${progress}%</strong>
            </div>
            <div class="goal-progress-bar"><span style="width: ${progress}%"></span></div>
            <div class="goal-actions">
              <button type="button" class="secondary-btn" data-goal-action="toggle" data-goal-id="${goal.id}">${goal.completed ? "Mark Pending" : "Mark Complete"}</button>
              <button type="button" class="secondary-btn" data-goal-action="edit" data-goal-id="${goal.id}">Edit</button>
              <button type="button" class="secondary-btn danger-btn" data-goal-action="delete" data-goal-id="${goal.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function openGoalModal(goalToEdit = null) {
    const modal = document.createElement("div");
    modal.className = "achievement-modal";
    modal.innerHTML = `
      <div class="achievement-modal-backdrop" data-close-goal-modal="true"></div>
      <div class="achievement-modal-panel" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
        <div class="achievement-modal-header">
          <div>
            <p class="achievement-modal-kicker">Goal Setup</p>
            <h3 id="goal-modal-title">${goalToEdit ? "Edit Goal" : "Add New Goal"}</h3>
          </div>
          <button type="button" class="achievement-close-btn" data-close-goal-modal="true" aria-label="Close goal form">×</button>
        </div>

        <form id="goal-form" class="goal-form">
          <label>
            <span>Goal name</span>
            <input name="title" type="text" value="${goalToEdit ? escapeHtml(goalToEdit.title) : ""}" required />
          </label>
          <label>
            <span>Category</span>
            <input name="category" type="text" value="${goalToEdit ? escapeHtml(goalToEdit.category) : "General"}" />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description" rows="3">${goalToEdit ? escapeHtml(goalToEdit.description) : ""}</textarea>
          </label>
          <div class="goal-form-row">
            <label>
              <span>Current</span>
              <input name="current" type="number" min="0" value="${goalToEdit ? goalToEdit.current : 0}" />
            </label>
            <label>
              <span>Target</span>
              <input name="target" type="number" min="1" value="${goalToEdit ? goalToEdit.target : 1}" required />
            </label>
          </div>
          <div class="goal-form-actions">
            <button type="button" class="secondary-btn" data-close-goal-modal="true">Cancel</button>
            <button type="submit" class="primary-btn">Save Goal</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.closeGoalModal === "true") {
        modal.remove();
      }
    });

    const form = modal.querySelector("#goal-form");
    form.addEventListener("submit", (submitEvent) => {
      submitEvent.preventDefault();
      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const category = String(formData.get("category") || "General").trim() || "General";
      const description = String(formData.get("description") || "").trim();
      const current = Number(formData.get("current") || 0);
      const target = Number(formData.get("target") || 1);

      if (!title) {
        alert("Goal title is required.");
        return;
      }

      const preparedGoal = {
        id: goalToEdit ? goalToEdit.id : Date.now(),
        title,
        description,
        category,
        target: Math.max(1, target),
        current: Math.min(Math.max(0, current), Math.max(1, target)),
        completed: goalToEdit ? goalToEdit.completed : current >= Math.max(1, target),
        createdAt: goalToEdit ? goalToEdit.createdAt : toDateKey(new Date()),
      };

      if (goalToEdit) {
        state.goals = state.goals.map((goal) => (goal.id === goalToEdit.id ? { ...goal, ...preparedGoal } : goal));
      } else {
        state.goals.push(preparedGoal);
      }

      saveGoals();
      renderGoalsView();
      modal.remove();
    });
  }

  function handleGoalActions(event) {
    const goalButton = event.target.closest("[data-goal-action]");
    if (!goalButton) return;

    const goalId = Number(goalButton.dataset.goalId);
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal) return;

    if (goalButton.dataset.goalAction === "toggle") {
      goal.completed = !goal.completed;
      if (!goal.completed) {
        goal.current = Math.min(goal.current, goal.target - 1);
      }
      saveGoals();
      renderGoalsView();
      return;
    }

    if (goalButton.dataset.goalAction === "edit") {
      openGoalModal(goal);
      return;
    }

    if (goalButton.dataset.goalAction === "delete") {
      const confirmed = window.confirm(`Delete goal "${goal.title}"?`);
      if (!confirmed) return;

      state.goals = state.goals.filter((item) => item.id !== goalId);
      saveGoals();
      renderGoalsView();
    }
  }

  // Keep the settings view synchronized with the saved user preferences and theme values.
  function renderSettingsView() {
    const themeButtons = document.querySelectorAll("[data-settings-theme]");
    const notificationsCheckbox = document.getElementById("setting-notifications");
    const summaryCheckbox = document.getElementById("setting-weekly-summary");

    themeButtons.forEach((button) => {
      const isActive = button.dataset.settingsTheme === state.settings.theme;
      button.classList.toggle("active", isActive);
    });

    if (notificationsCheckbox) {
      notificationsCheckbox.checked = Boolean(state.settings.notifications);
    }

    if (summaryCheckbox) {
      summaryCheckbox.checked = Boolean(state.settings.weeklySummary);
    }
  }

  function renderStatistics() {
    const statsGrid = document.getElementById("statistics-grid");
    const progressBars = document.getElementById("statistics-progress-bars");
    if (!statsGrid || !progressBars) return;

    const total = state.habits.length;
    const completed = state.habits.filter((habit) => isCompletedOnDate(habit, getCurrentDateKey())).length;
    const currentStreak = state.habits.reduce((highest, habit) => Math.max(highest, getHabitStreaks(habit).current), 0);
    const successRate = total ? Math.round((completed / total) * 100) : 0;

    const totalEl = document.getElementById("stat-total-habits");
    const completedEl = document.getElementById("stat-completed-habits");
    const streakEl = document.getElementById("stat-current-streak");
    const successEl = document.getElementById("stat-success-rate");

    if (totalEl) totalEl.textContent = String(total);
    if (completedEl) completedEl.textContent = String(completed);
    if (streakEl) streakEl.textContent = String(currentStreak);
    if (successEl) successEl.textContent = `${successRate}%`;

    progressBars.innerHTML = state.habits
      .map((habit) => {
        const habitScore = Math.min(100, Math.max(0, Math.round((habit.completedDates.length / Math.max(1, habit.completedDates.length + 2)) * 100)));
        return `
          <div class="stat-progress-item">
            <div class="stat-progress-header">
              <span>${escapeHtml(habit.name)}</span>
              <strong>${habitScore}%</strong>
            </div>
            <div class="stat-progress-track">
              <span class="stat-progress-fill" style="width: ${habitScore}%"></span>
            </div>
          </div>
        `;
      })
      .join("");

    updateReportSummary();
    renderHeatmap();
  }

  function setPageTitle(title) {
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = title;
  }

  function toggleMobileSidebar(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !document.body.classList.contains("sidebar-open");
    const sidebar = document.querySelector(".sidebar");

    document.body.classList.toggle("sidebar-open", shouldOpen);
    document.body.style.overflow = shouldOpen ? "hidden" : "";

    if (sidebar && window.innerWidth < 768) {
      sidebar.style.transform = shouldOpen ? "translateX(0)" : "translateX(-120%)";
    } else if (sidebar) {
      sidebar.style.transform = "";
    }
  }

  function setActiveSection(targetView) {
    const sections = document.querySelectorAll(".view-section");
    sections.forEach((section) => {
      section.classList.toggle("active", section.dataset.section === targetView);
    });

    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      const isActive = link.dataset.view === targetView;
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });

    const sectionTitles = {
      dashboard: "Dashboard",
      habits: "My Habits",
      calendar: "Calendar",
      statistics: "Statistics",
      heatmap: "Habit Heatmap",
      achievements: "Achievements",
      goals: "Goals",
      settings: "Settings",
    };

    setPageTitle(sectionTitles[targetView] || "Dashboard");
  }

  function attachNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      const goToView = () => {
        const target = link.dataset.view;
        if (!target) return;
        setActiveSection(target);
        if (window.innerWidth < 768) {
          toggleMobileSidebar(false);
        }
      };

      link.addEventListener("click", (event) => {
        event.preventDefault();
        goToView();
      });

      link.addEventListener("touchstart", (event) => {
        event.preventDefault();
        goToView();
      }, { passive: false });
    });

    const mobileToggle = document.querySelector("[data-mobile-nav-toggle]");
    if (mobileToggle) {
      mobileToggle.addEventListener("click", () => {
        toggleMobileSidebar();
      });
      mobileToggle.addEventListener("touchstart", (event) => {
        event.preventDefault();
        toggleMobileSidebar();
      }, { passive: false });
    }

    const mobileCloseTargets = document.querySelectorAll("[data-mobile-nav-close]");
    mobileCloseTargets.forEach((element) => {
      element.addEventListener("click", () => {
        toggleMobileSidebar(false);
      });
    });

    document.querySelectorAll("[data-back-dashboard]").forEach((button) => {
      button.addEventListener("click", () => setActiveSection("dashboard"));
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768) {
        toggleMobileSidebar(false);
      }
    });
  }

  // Re-render the whole dashboard after any habit or theme change.
  function renderDashboard() {
    syncAchievementUnlocks();
    renderProgressSummary();
    renderDailyChecklist();
    renderHabitCards();
    renderWeeklyProgress();
    renderCalendar();
    renderStatistics();
    renderAchievementSummary();
    renderAchievementLibrary();
    renderGoalsView();
    renderSettingsView();
    renderHeatmap();
  }

  // Bootstraps the app and attaches all event listeners.
  function initialize() {
    loadState();
    initializeTheme();

    const addButtons = document.querySelectorAll("#add-habit-btn, #add-habit-inline");
    addButtons.forEach((button) => {
      button.addEventListener("click", () => openHabitModal());
    });

    const themeToggle = document.querySelector("[data-theme-toggle]");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const nextTheme = state.settings.theme === "dark" ? "light" : "dark";
        state.settings.theme = nextTheme;
        saveSettings();
        applyTheme(nextTheme);
        renderSettingsView();
      });
    }

    document.getElementById("add-goal-btn")?.addEventListener("click", () => openGoalModal());
    document.getElementById("export-data-btn")?.addEventListener("click", () => {
      const payload = {
        habits: state.habits,
        goals: state.goals,
        achievements: state.achievementUnlocks,
        settings: state.settings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "habitflow-export.json";
      link.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("reset-data-btn")?.addEventListener("click", () => {
      if (!window.confirm("Reset all saved HabitFlow data? This cannot be undone.")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.removeItem(ACHIEVEMENTS_STORAGE_KEY);
      localStorage.removeItem(GOALS_STORAGE_KEY);
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      window.location.reload();
    });

    document.querySelectorAll("[data-settings-theme]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTheme = button.dataset.settingsTheme === "dark" ? "dark" : "light";
        state.settings.theme = nextTheme;
        saveSettings();
        applyTheme(nextTheme);
        renderSettingsView();
      });
    });

    document.getElementById("setting-notifications")?.addEventListener("change", (event) => {
      state.settings.notifications = Boolean(event.target.checked);
      saveSettings();
    });

    document.getElementById("setting-weekly-summary")?.addEventListener("change", (event) => {
      state.settings.weeklySummary = Boolean(event.target.checked);
      saveSettings();
    });

    document.body.addEventListener("click", handleCardAction);
    document.body.addEventListener("click", handleGoalActions);

    attachNavigation();
    attachReportControls();
    attachHeatmapControls();
    const viewAchievementsButton = document.getElementById("view-achievements-btn");
    if (viewAchievementsButton) {
      viewAchievementsButton.addEventListener("click", () => setActiveSection("achievements"));
    }
    setActiveSection("dashboard");
    renderDashboard();
  }

  return {
    state,
    buildSeedHabits,
    createDefaultState,
    loadState,
    saveState,
    normalizeHabit,
    getHabits: () => state.habits,
    calculateHabitStreaks: getHabitStreaks,
    getProgressSummary,
    buildCalendarMonth,
    buildWeekData,
    renderDashboard,
    initialize,
    openHabitModal,
    handleCardAction,
    applyTheme,
    getCurrentDateKey,
    toDateKey,
    buildPeriodSummary,
    renderHeatmap,
    getAchievementSummary,
    getAchievementMetrics,
    syncAchievementUnlocks,
    renderAchievementModal,
    achievementDefinitions,
  };
})();

if (typeof window !== "undefined") {
  window.HabitFlowApp = HabitFlowApp;
  window.applyTheme = HabitFlowApp.applyTheme;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    HabitFlowApp.initialize();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = HabitFlowApp;
}

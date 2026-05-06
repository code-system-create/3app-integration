const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEY = "three-app-integration-state-v2";

const CATEGORY_OPTIONS = ["主食", "メイン", "副菜", "おやつ", "ドリンク", "その他"];
const MEAL_LABELS = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
  snack: "間食",
};
const MEAL_KEYS = Object.keys(MEAL_LABELS);
const ROUTINE_CATEGORIES = ["スキンケア", "コンタクト", "健康", "家事", "その他"];
const FREQUENCY_TYPES = ["毎日", "日ごと", "週間ごと", "ヶ月ごと"];

const INITIAL_FOODS = [
  { id: "food-protein", name: "プロテイン", calories: 100, protein: 20, fat: 1, carbs: 3, category: "メイン" },
  { id: "food-tofu", name: "豆腐", calories: 90, protein: 7, fat: 5, carbs: 3, category: "副菜" },
  { id: "food-egg", name: "卵", calories: 80, protein: 6, fat: 5, carbs: 0, category: "メイン" },
  { id: "food-rice-porridge", name: "おかゆ", calories: 150, protein: 3, fat: 1, carbs: 32, category: "主食" },
  { id: "food-miso-soup", name: "味噌汁", calories: 50, protein: 3, fat: 2, carbs: 5, category: "副菜" },
  { id: "food-mekabu", name: "めかぶ", calories: 10, protein: 1, fat: 0, carbs: 2, category: "副菜" },
  { id: "food-tuna", name: "ツナ缶", calories: 120, protein: 16, fat: 6, carbs: 0, category: "メイン" },
  { id: "food-sakekasu", name: "酒粕きなこはちみつ", calories: 180, protein: 7, fat: 5, carbs: 25, category: "おやつ" },
  { id: "food-cafe-latte", name: "カフェラテ", calories: 150, protein: 8, fat: 8, carbs: 12, category: "ドリンク" },
];

const INITIAL_MEAL_SETS = [
  {
    id: "set-morning",
    name: "朝の定番",
    foodIds: ["food-protein", "food-tofu", "food-egg", "food-rice-porridge", "food-miso-soup", "food-mekabu"],
  },
  {
    id: "set-light-dinner",
    name: "夜の軽め",
    foodIds: ["food-rice-porridge", "food-egg", "food-tuna", "food-miso-soup"],
  },
  {
    id: "set-sakekasu",
    name: "酒粕セット",
    foodIds: ["food-sakekasu"],
  },
];

function createId(prefix = "id") {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLocalNow() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000);
}

function getTodayDateString() {
  return getLocalNow().toISOString().slice(0, 10);
}

function getLocalDateTimeString() {
  return getLocalNow().toISOString().slice(0, 16);
}

function parseLocalDate(dateString) {
  if (!dateString) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parseLocalDate(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseLocalDate(dateString));
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function createMonthDate(year, monthIndex, day = 1) {
  return new Date(year, monthIndex, day);
}

function getCalendarDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = createMonthDate(year, month, 1);
  const lastDay = createMonthDate(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(createMonthDate(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function sumNutrition(items) {
  return items.reduce(
    (total, item) => {
      total.calories += Number(item.calories || 0);
      total.protein += Number(item.protein || 0);
      total.fat += Number(item.fat || 0);
      total.carbs += Number(item.carbs || 0);
      return total;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function calculatePfcPercentages(totals) {
  const proteinCalories = totals.protein * 4;
  const fatCalories = totals.fat * 9;
  const carbsCalories = totals.carbs * 4;
  const totalMacroCalories = proteinCalories + fatCalories + carbsCalories;

  if (!totalMacroCalories) return { protein: 0, fat: 0, carbs: 0 };

  return {
    protein: Math.round((proteinCalories / totalMacroCalories) * 100),
    fat: Math.round((fatCalories / totalMacroCalories) * 100),
    carbs: Math.round((carbsCalories / totalMacroCalories) * 100),
  };
}

function ensureMealRecordShape(record) {
  return {
    breakfast: Array.isArray(record?.breakfast) ? record.breakfast : [],
    lunch: Array.isArray(record?.lunch) ? record.lunch : [],
    dinner: Array.isArray(record?.dinner) ? record.dinner : [],
    snack: Array.isArray(record?.snack) ? record.snack : [],
  };
}

function buildMealEntry(foodLike, source, setName = "") {
  return {
    entryId: createId("meal-entry"),
    foodId: foodLike.id || null,
    name: foodLike.name,
    calories: Number(foodLike.calories) || 0,
    protein: Number(foodLike.protein) || 0,
    fat: Number(foodLike.fat) || 0,
    carbs: Number(foodLike.carbs) || 0,
    category: foodLike.category || "その他",
    source,
    setName,
    recordedAt: new Date().toISOString(),
  };
}

function groupFoodsByCategory(foods) {
  const groups = CATEGORY_OPTIONS.map((category) => ({
    category,
    foods: foods.filter((food) => food.category === category),
  })).filter((group) => group.foods.length > 0);

  const extraFoods = foods.filter((food) => !CATEGORY_OPTIONS.includes(food.category));
  if (extraFoods.length > 0) {
    groups.push({ category: "その他", foods: extraFoods });
  }

  return groups;
}

function calculateNextDueDate(baseDateString, frequencyType, interval) {
  const nextDate = parseLocalDate(baseDateString);

  switch (frequencyType) {
    case "毎日":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "日ごと":
      nextDate.setDate(nextDate.getDate() + Number(interval || 1));
      break;
    case "週間ごと":
      nextDate.setDate(nextDate.getDate() + Number(interval || 1) * 7);
      break;
    case "ヶ月ごと":
      nextDate.setMonth(nextDate.getMonth() + Number(interval || 1));
      break;
    default:
      nextDate.setDate(nextDate.getDate() + 1);
  }

  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
}

function getFrequencyLabel(frequencyType, interval) {
  if (frequencyType === "毎日") return "毎日";
  if (frequencyType === "日ごと") return `${interval}日ごと`;
  if (frequencyType === "週間ごと") return `${interval}週間ごと`;
  if (frequencyType === "ヶ月ごと") return `${interval}ヶ月ごと`;
  return frequencyType;
}

function getNotificationSupport() {
  if (typeof window === "undefined") {
    return { available: false, reason: "通知はこの端末では利用できません" };
  }

  const supportsNotification = "Notification" in window;
  const isFilePreview = window.location.protocol === "file:";
  const isSecure = window.isSecureContext || isFilePreview;

  if (!supportsNotification || !isSecure) {
    return { available: false, reason: "通知はこの端末では利用できません" };
  }

  return { available: true, reason: "" };
}

function buildReminderNotificationBody(routines) {
  const names = routines.slice(0, 3).map((routine) => `・${routine.name}`);
  const extraCount = routines.length - names.length;
  return ["今日のリマインドがあります。", ...names, extraCount > 0 ? `・ほか${extraCount}件` : ""]
    .filter(Boolean)
    .join("\n");
}

function priorityLabel(priority) {
  if (priority === "high") return "高";
  if (priority === "medium") return "中";
  return "低";
}

function formatAmount(value, prefix, unit) {
  if (prefix) return `${prefix}${value.toLocaleString("ja-JP")}`;
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

function sumMoney(records) {
  return records.reduce((sum, record) => sum + Number(record.money || 0), 0);
}

function sumCalories(records) {
  return records.reduce((sum, record) => sum + Number(record.calories || 0), 0);
}

function normalizeSaveRecord(record) {
  if (!record || typeof record !== "object") return null;
  const createdAt = record.createdAt || new Date().toISOString();
  const date = record.date || getTodayDateString();
  return {
    id: record.id || createId("save-record"),
    date,
    entryType: record.entryType || "money",
    itemName: record.itemName || "",
    money: Number(record.money) || 0,
    calories: Number(record.calories) || 0,
    memo: record.memo || "",
    createdAt,
  };
}

function createInitialState() {
  return {
    meal: {
      foods: INITIAL_FOODS,
      mealSets: INITIAL_MEAL_SETS,
      records: {},
    },
    routines: [
      {
        id: createId("routine"),
        name: "夜のスキンケア",
        category: "スキンケア",
        frequencyType: "毎日",
        interval: 1,
        startDate: getTodayDateString(),
        nextDueDate: getTodayDateString(),
        lastCompletedAt: null,
        completedForDate: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: createId("routine"),
        name: "コンタクト交換",
        category: "コンタクト",
        frequencyType: "週間ごと",
        interval: 2,
        startDate: getTodayDateString(),
        nextDueDate: getTodayDateString(),
        lastCompletedAt: null,
        completedForDate: null,
        createdAt: new Date().toISOString(),
      },
    ],
    save: {
      records: [],
      goals: [],
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    const initial = createInitialState();
    return {
      meal: {
        foods: Array.isArray(parsed?.meal?.foods) ? parsed.meal.foods : initial.meal.foods,
        mealSets: Array.isArray(parsed?.meal?.mealSets) ? parsed.meal.mealSets : initial.meal.mealSets,
        records: parsed?.meal?.records && typeof parsed.meal.records === "object" ? parsed.meal.records : {},
      },
      routines: Array.isArray(parsed?.routines)
        ? parsed.routines.map((routine) => ({ completedForDate: null, ...routine }))
        : initial.routines,
      save: {
        records: Array.isArray(parsed?.save?.records)
          ? parsed.save.records.map(normalizeSaveRecord).filter(Boolean)
          : [],
        goals: Array.isArray(parsed?.save?.goals) ? parsed.save.goals : [],
      },
    };
  } catch (error) {
    console.error("Failed to load state:", error);
    return createInitialState();
  }
}

function FoodChip({ food, onClick }) {
  return (
    <button className="chip-button" onClick={onClick} type="button">
      <span>{food.name}</span>
      <small>{food.calories}kcal</small>
    </button>
  );
}

function MealSetCard({ mealSet, foodsById, onAdd, onEdit, onDelete }) {
  const foods = mealSet.foodIds.map((id) => foodsById[id]).filter(Boolean);
  const totals = sumNutrition(foods);

  return (
    <article className="mini-card">
      <div className="mini-card__head">
        <div>
          <h3>{mealSet.name}</h3>
          <p>{foods.length > 0 ? foods.map((food) => food.name).join(" / ") : "セット内容が未選択です"}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onAdd} disabled={foods.length === 0}>
          記録
        </button>
      </div>
      <p className="meta-row">
        {totals.calories}kcal / P {totals.protein}g / F {totals.fat}g / C {totals.carbs}g
      </p>
      <div className="inline-actions">
        <button className="ghost-button" type="button" onClick={onEdit}>
          編集
        </button>
        <button className="ghost-button" type="button" onClick={onDelete}>
          削除
        </button>
      </div>
    </article>
  );
}

function FoodManageCard({ food, onAdd, onEdit, onDelete }) {
  return (
    <article className="mini-card">
      <div className="mini-card__head">
        <div>
          <h3>{food.name}</h3>
          <p className="meta-row">{food.category}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onAdd}>
          記録
        </button>
      </div>
      <p className="meta-row">
        {food.calories}kcal / P {food.protein}g / F {food.fat}g / C {food.carbs}g
      </p>
      <div className="inline-actions">
        <button className="ghost-button" type="button" onClick={onEdit}>
          編集
        </button>
        <button className="ghost-button" type="button" onClick={onDelete}>
          削除
        </button>
      </div>
    </article>
  );
}

function MealRecordAccordion({ label, items, isExpanded, onToggle, onRemoveEntry }) {
  const totals = sumNutrition(items);
  const pfc = calculatePfcPercentages(totals);

  return (
    <article className="goal-card accordion-card">
      <button type="button" className="accordion-toggle" onClick={onToggle}>
        <div>
          <h3>{label}</h3>
          <p className="meta-row">
            {totals.calories}kcal / P {totals.protein}g / F {totals.fat}g / C {totals.carbs}g
          </p>
        </div>
        <div className="accordion-side">
          <span className="pill">{items.length}件</span>
          <span className={isExpanded ? "accordion-icon is-open" : "accordion-icon"}>⌄</span>
        </div>
      </button>
      <div className="pfc-bar">
        <div className="pfc-segment protein" style={{ width: `${pfc.protein}%` }} />
        <div className="pfc-segment fat" style={{ width: `${pfc.fat}%` }} />
        <div className="pfc-segment carbs" style={{ width: `${pfc.carbs}%` }} />
      </div>
      {isExpanded && (
        <div className="record-list">
          {items.length === 0 && <p className="empty-state">まだ記録がありません。</p>}
          {items.map((entry) => (
            <article key={entry.entryId} className="record-card">
              <div className="record-card__body">
                <p className="record-card__title">{entry.name}</p>
                <p className="record-card__meta">
                  {entry.calories}kcal / P{entry.protein} F{entry.fat} C{entry.carbs}
                </p>
                {entry.setName && <p className="record-card__text">{entry.setName} から追加</p>}
              </div>
              <button type="button" className="ghost-button" onClick={() => onRemoveEntry(entry.entryId)}>
                削除
              </button>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [state, setState] = useState(loadState);
  const [toast, setToast] = useState("");
  const [selectedMealDate, setSelectedMealDate] = useState(getTodayDateString());
  const [selectedMealKey, setSelectedMealKey] = useState("breakfast");
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showMealSetForm, setShowMealSetForm] = useState(false);
  const [showFoodList, setShowFoodList] = useState(false);
  const [showMealSetList, setShowMealSetList] = useState(false);
  const [expandedMeals, setExpandedMeals] = useState({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
  });
  const [mealHistoryMonth, setMealHistoryMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [mealHistoryDate, setMealHistoryDate] = useState(getTodayDateString());
  const [freeMealForm, setFreeMealForm] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
    category: "その他",
  });
  const [foodForm, setFoodForm] = useState({
    id: null,
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
    category: "主食",
  });
  const [mealSetForm, setMealSetForm] = useState({
    id: null,
    name: "",
    foodIds: [],
  });
  const [routineForm, setRoutineForm] = useState({
    name: "",
    category: "スキンケア",
    frequencyType: "毎日",
    interval: 1,
    startDate: getTodayDateString(),
  });
  const [saveRecordForm, setSaveRecordForm] = useState({
    itemName: "",
    entryType: "money",
    money: "",
    calories: "",
    memo: "",
  });
  const [goalForm, setGoalForm] = useState({
    type: "money",
    name: "",
    target: "",
    priority: "high",
  });
  const [saveHistoryMonth, setSaveHistoryMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [saveHistoryDate, setSaveHistoryDate] = useState(getTodayDateString());
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const hasNotifiedThisSession = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const foodsById = useMemo(
    () => Object.fromEntries(state.meal.foods.map((food) => [food.id, food])),
    [state.meal.foods]
  );
  const groupedFoods = useMemo(() => groupFoodsByCategory(state.meal.foods), [state.meal.foods]);
  const mealRecord = ensureMealRecordShape(state.meal.records[selectedMealDate]);
  const todayMealRecord = ensureMealRecordShape(state.meal.records[getTodayDateString()]);
  const todayMealItems = MEAL_KEYS.flatMap((mealKey) => todayMealRecord[mealKey]);
  const todayMealTotals = sumNutrition(todayMealItems);
  const mealHistoryEntries = useMemo(() => {
    return Object.entries(state.meal.records)
      .map(([date, record]) => {
        const normalized = ensureMealRecordShape(record);
        const items = MEAL_KEYS.flatMap((mealKey) => normalized[mealKey]);
        return { date, meals: normalized, totals: sumNutrition(items) };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [state.meal.records]);
  const mealHistoryByDate = useMemo(
    () => Object.fromEntries(mealHistoryEntries.map((entry) => [entry.date, entry])),
    [mealHistoryEntries]
  );
  const selectedMealHistoryEntry = mealHistoryByDate[mealHistoryDate] || null;
  const mealCalendarDays = useMemo(() => getCalendarDays(mealHistoryMonth), [mealHistoryMonth]);

  const today = getTodayDateString();
  const todayRoutines = useMemo(
    () =>
      state.routines
        .filter((routine) => routine.nextDueDate <= today || routine.completedForDate === today)
        .sort((a, b) => {
          const aDone = a.completedForDate === today ? 1 : 0;
          const bDone = b.completedForDate === today ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return a.name.localeCompare(b.name, "ja");
        }),
    [state.routines, today]
  );
  const pendingTodayRoutines = useMemo(
    () => todayRoutines.filter((routine) => routine.completedForDate !== today),
    [todayRoutines, today]
  );
  const completedTodayRoutines = useMemo(
    () => todayRoutines.filter((routine) => routine.completedForDate === today),
    [todayRoutines, today]
  );
  const notificationSupport = getNotificationSupport();

  useEffect(() => {
    if (
      !notificationSupport.available ||
      notificationPermission !== "granted" ||
      pendingTodayRoutines.length === 0 ||
      hasNotifiedThisSession.current
    ) {
      return;
    }

    const notification = new Notification("Routine Reminder", {
      body: buildReminderNotificationBody(pendingTodayRoutines),
      tag: `routine-reminder-${today}`,
    });

    hasNotifiedThisSession.current = true;
    notification.onclick = () => window.focus();
  }, [notificationPermission, notificationSupport.available, pendingTodayRoutines, today]);

  const saveRecords = useMemo(
    () => [...state.save.records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [state.save.records]
  );
  const todaySaveRecords = saveRecords.filter((record) => record.date === today);
  const totalSavedMoney = sumMoney(saveRecords);
  const totalSavedCalories = sumCalories(saveRecords);
  const todaySavedMoney = sumMoney(todaySaveRecords);
  const todaySavedCalories = sumCalories(todaySaveRecords);
  const sortedGoals = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...state.save.goals].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [state.save.goals]);
  const activeMoneyGoal = sortedGoals.find((goal) => goal.type === "money");
  const activeCalorieGoal = sortedGoals.find((goal) => goal.type === "calorie");
  const saveCalendarDays = useMemo(() => getCalendarDays(saveHistoryMonth), [saveHistoryMonth]);
  const saveRecordsByDate = useMemo(() => {
    const map = {};
    saveRecords.forEach((record) => {
      map[record.date] = map[record.date] || [];
      map[record.date].push(record);
    });
    return map;
  }, [saveRecords]);
  const saveHistoryRecords = saveRecordsByDate[saveHistoryDate] || [];

  function updateMealRecords(date, updater) {
    setState((current) => {
      const currentRecord = ensureMealRecordShape(current.meal.records[date]);
      const nextRecord = ensureMealRecordShape(updater(currentRecord));
      return {
        ...current,
        meal: {
          ...current.meal,
          records: {
            ...current.meal.records,
            [date]: nextRecord,
          },
        },
      };
    });
  }

  function resetFoodForm() {
    setShowFoodForm(false);
    setFoodForm({
      id: null,
      name: "",
      calories: "",
      protein: "",
      fat: "",
      carbs: "",
      category: "主食",
    });
  }

  function resetMealSetForm() {
    setShowMealSetForm(false);
    setMealSetForm({
      id: null,
      name: "",
      foodIds: [],
    });
  }

  function showToast(message) {
    setToast(message);
  }

  function addFoodToMeal(foodLike, source = "food", setName = "") {
    const entry = buildMealEntry(foodLike, source, setName);
    updateMealRecords(selectedMealDate, (record) => ({
      ...record,
      [selectedMealKey]: [...record[selectedMealKey], entry],
    }));
    showToast("記録しました");
  }

  function addSetToMeal(mealSet) {
    const foods = mealSet.foodIds.map((id) => foodsById[id]).filter(Boolean);
    updateMealRecords(selectedMealDate, (record) => ({
      ...record,
      [selectedMealKey]: [
        ...record[selectedMealKey],
        ...foods.map((food) => buildMealEntry(food, "set", mealSet.name)),
      ],
    }));
    showToast("追加しました");
  }

  function addFreeMealEntry(event) {
    event.preventDefault();
    if (!freeMealForm.name.trim()) return;
    addFoodToMeal(
      {
        name: freeMealForm.name.trim(),
        calories: Number(freeMealForm.calories) || 0,
        protein: Number(freeMealForm.protein) || 0,
        fat: Number(freeMealForm.fat) || 0,
        carbs: Number(freeMealForm.carbs) || 0,
        category: freeMealForm.category,
      },
      "free"
    );
    setFreeMealForm({
      name: "",
      calories: "",
      protein: "",
      fat: "",
      carbs: "",
      category: "その他",
    });
  }

  function saveFood(event) {
    event.preventDefault();
    if (!foodForm.name.trim()) return;

    const nextFood = {
      id: foodForm.id || createId("food"),
      name: foodForm.name.trim(),
      calories: Number(foodForm.calories) || 0,
      protein: Number(foodForm.protein) || 0,
      fat: Number(foodForm.fat) || 0,
      carbs: Number(foodForm.carbs) || 0,
      category: foodForm.category,
    };

    setState((current) => ({
      ...current,
      meal: {
        ...current.meal,
        foods: foodForm.id
          ? current.meal.foods.map((food) => (food.id === foodForm.id ? nextFood : food))
          : [nextFood, ...current.meal.foods],
      },
    }));
    resetFoodForm();
    showToast(foodForm.id ? "更新しました" : "追加しました");
  }

  function startEditFood(food) {
    setShowFoodForm(true);
    setFoodForm({
      id: food.id,
      name: food.name,
      calories: String(food.calories ?? ""),
      protein: String(food.protein ?? ""),
      fat: String(food.fat ?? ""),
      carbs: String(food.carbs ?? ""),
      category: food.category || "その他",
    });
  }

  function deleteFood(foodId) {
    setState((current) => ({
      ...current,
      meal: {
        ...current.meal,
        foods: current.meal.foods.filter((food) => food.id !== foodId),
        mealSets: current.meal.mealSets.map((mealSet) => ({
          ...mealSet,
          foodIds: mealSet.foodIds.filter((id) => id !== foodId),
        })),
      },
    }));
    if (foodForm.id === foodId) resetFoodForm();
    showToast("削除しました");
  }

  function toggleFoodInSet(foodId) {
    setMealSetForm((current) => ({
      ...current,
      foodIds: current.foodIds.includes(foodId)
        ? current.foodIds.filter((id) => id !== foodId)
        : [...current.foodIds, foodId],
    }));
  }

  function saveMealSet(event) {
    event.preventDefault();
    if (!mealSetForm.name.trim() || mealSetForm.foodIds.length === 0) return;

    const nextSet = {
      id: mealSetForm.id || createId("meal-set"),
      name: mealSetForm.name.trim(),
      foodIds: mealSetForm.foodIds,
    };

    setState((current) => ({
      ...current,
      meal: {
        ...current.meal,
        mealSets: mealSetForm.id
          ? current.meal.mealSets.map((mealSet) => (mealSet.id === mealSetForm.id ? nextSet : mealSet))
          : [nextSet, ...current.meal.mealSets],
      },
    }));
    resetMealSetForm();
    showToast(mealSetForm.id ? "更新しました" : "追加しました");
  }

  function startEditMealSet(mealSet) {
    setShowMealSetForm(true);
    setMealSetForm({
      id: mealSet.id,
      name: mealSet.name,
      foodIds: mealSet.foodIds,
    });
  }

  function deleteMealSet(mealSetId) {
    setState((current) => ({
      ...current,
      meal: {
        ...current.meal,
        mealSets: current.meal.mealSets.filter((mealSet) => mealSet.id !== mealSetId),
      },
    }));
    if (mealSetForm.id === mealSetId) resetMealSetForm();
    showToast("削除しました");
  }

  function removeMealEntry(date, mealKey, entryId) {
    updateMealRecords(date, (record) => ({
      ...record,
      [mealKey]: record[mealKey].filter((entry) => entry.entryId !== entryId),
    }));
    showToast("削除しました");
  }

  function handleAddRoutine(event) {
    event.preventDefault();
    if (!routineForm.name.trim()) return;

    const nextRoutine = {
      id: createId("routine"),
      name: routineForm.name.trim(),
      category: routineForm.category,
      frequencyType: routineForm.frequencyType,
      interval: routineForm.frequencyType === "毎日" ? 1 : Number(routineForm.interval || 1),
      startDate: routineForm.startDate,
      nextDueDate: routineForm.startDate,
      lastCompletedAt: null,
      completedForDate: null,
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({ ...current, routines: [nextRoutine, ...current.routines] }));
    setRoutineForm({
      name: "",
      category: routineForm.category,
      frequencyType: routineForm.frequencyType,
      interval: routineForm.interval,
      startDate: getTodayDateString(),
    });
    showToast("追加しました");
  }

  function completeRoutine(id) {
    setState((current) => ({
      ...current,
      routines: current.routines.map((routine) => {
        if (routine.id !== id) return routine;
        const baseDate = today > routine.nextDueDate ? today : routine.nextDueDate;
        return {
          ...routine,
          lastCompletedAt: today,
          completedForDate: today,
          previousNextDueDate: routine.nextDueDate,
          nextDueDate: calculateNextDueDate(baseDate, routine.frequencyType, routine.interval),
        };
      }),
    }));
    showToast("完了しました");
  }

  function uncompleteRoutine(id) {
    setState((current) => ({
      ...current,
      routines: current.routines.map((routine) => {
        if (routine.id !== id) return routine;
        return {
          ...routine,
          lastCompletedAt: null,
          completedForDate: null,
          nextDueDate: routine.previousNextDueDate || routine.startDate,
          previousNextDueDate: null,
        };
      }),
    }));
    showToast("未完了に戻しました");
  }

  function deleteRoutine(id) {
    setState((current) => ({
      ...current,
      routines: current.routines.filter((routine) => routine.id !== id),
    }));
    showToast("削除しました");
  }

  async function enableNotifications() {
    if (!notificationSupport.available) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        hasNotifiedThisSession.current = false;
        showToast("通知を許可しました");
      }
    } catch (error) {
      console.error("Failed to request notification permission:", error);
    }
  }

  function addSaveRecord(event) {
    event.preventDefault();
    if (!saveRecordForm.itemName.trim()) return;
    const money = saveRecordForm.entryType === "calorie" ? 0 : Number(saveRecordForm.money) || 0;
    const calories = saveRecordForm.entryType === "money" ? 0 : Number(saveRecordForm.calories) || 0;
    if (
      (saveRecordForm.entryType === "money" && money <= 0) ||
      (saveRecordForm.entryType === "calorie" && calories <= 0) ||
      (saveRecordForm.entryType === "both" && (money <= 0 || calories <= 0))
    ) {
      return;
    }

    const nextRecord = {
      id: createId("save-record"),
      date: today,
      entryType: saveRecordForm.entryType,
      itemName: saveRecordForm.itemName.trim(),
      money,
      calories,
      memo: saveRecordForm.memo.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      save: {
        ...current.save,
        records: [nextRecord, ...current.save.records],
      },
    }));
    setSaveRecordForm({
      itemName: "",
      entryType: "money",
      money: "",
      calories: "",
      memo: "",
    });
    setSaveHistoryDate(today);
    setSaveHistoryMonth(new Date());
    showToast("記録しました");
  }

  function addGoal(event) {
    event.preventDefault();
    if (!goalForm.name.trim() || Number(goalForm.target) <= 0) return;
    const nextGoal = {
      id: createId("goal"),
      type: goalForm.type,
      name: goalForm.name.trim(),
      target: Number(goalForm.target),
      priority: goalForm.priority,
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      save: {
        ...current.save,
        goals: [nextGoal, ...current.save.goals],
      },
    }));
    setGoalForm({
      type: goalForm.type,
      name: "",
      target: "",
      priority: "high",
    });
    showToast("追加しました");
  }

  function deleteGoal(id) {
    setState((current) => ({
      ...current,
      save: {
        ...current.save,
        goals: current.save.goals.filter((goal) => goal.id !== id),
      },
    }));
    showToast("削除しました");
  }

  function deleteSaveRecord(id) {
    setState((current) => ({
      ...current,
      save: {
        ...current.save,
        records: current.save.records.filter((record) => record.id !== id),
      },
    }));
    showToast("削除しました");
  }

  function clearSaveRecords() {
    if (saveRecords.length === 0) return;
    if (!window.confirm("我慢ログの履歴をすべて削除しますか？")) return;
    setState((current) => ({
      ...current,
      save: {
        ...current.save,
        records: [],
      },
    }));
    showToast("履歴を削除しました");
  }

  function renderGoalCard(goal, saved, prefix, unit) {
    if (!goal) {
      return {
        name: "まだ設定されていません",
        priority: "優先度 -",
        status: "目標設定画面から追加できます。",
        progress: 0,
        saved: `${formatAmount(saved, prefix, unit)} たまりました`,
        remaining: `残り ${formatAmount(0, prefix, unit)}`,
      };
    }

    const progress = Math.min((saved / goal.target) * 100, 100);
    const remaining = Math.max(goal.target - saved, 0);
    return {
      name: goal.name,
      priority: `優先度 ${priorityLabel(goal.priority)}`,
      status:
        progress >= 100
          ? "目標達成です。ごほうびのタイミングです。"
          : `${formatAmount(saved, prefix, unit)} / ${formatAmount(goal.target, prefix, unit)} までたまりました。`,
      progress,
      saved: `${formatAmount(saved, prefix, unit)} たまりました`,
      remaining: `残り ${formatAmount(remaining, prefix, unit)}`,
    };
  }

  const moneyGoalCard = renderGoalCard(activeMoneyGoal, totalSavedMoney, "¥", "円");
  const calorieGoalCard = renderGoalCard(activeCalorieGoal, totalSavedCalories, "", "kcal");

  return (
    <div className="app-shell">
      <nav className="tab-bar" aria-label="画面切り替え">
        {[
          ["home", "ホーム"],
          ["meals", "食事記録"],
          ["routines", "リマインド"],
          ["save", "我慢ログ"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "tab active" : "tab"}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="content-grid">
        {activeTab === "home" && (
          <>
            <section className="panel panel--highlight stats">
              <article className="stat-card">
                <span>今日の食事</span>
                <strong>{todayMealTotals.calories} kcal</strong>
                <small>P {todayMealTotals.protein} / F {todayMealTotals.fat} / C {todayMealTotals.carbs}</small>
              </article>
              <article className="stat-card">
                <span>今日のリマインド</span>
                <strong>{pendingTodayRoutines.length} 件</strong>
                <small>完了済み {completedTodayRoutines.length} 件</small>
              </article>
              <article className="stat-card">
                <span>今日の我慢ログ</span>
                <strong>¥{todaySavedMoney.toLocaleString("ja-JP")}</strong>
                <small>{todaySavedCalories.toLocaleString("ja-JP")} kcal をセーブ</small>
              </article>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>食事記録の今日</h2>
                <p>{formatDate(today)}</p>
              </div>
              <div className="summary-stack">
                {MEAL_KEYS.map((mealKey) => {
                  const items = todayMealRecord[mealKey];
                  const totals = sumNutrition(items);
                  return (
                    <article key={mealKey} className="mini-card">
                      <div className="mini-card__head">
                        <h3>{MEAL_LABELS[mealKey]}</h3>
                        <span className="pill">{items.length}件</span>
                      </div>
                      <p className="meta-row">
                        {totals.calories}kcal / P {totals.protein} / F {totals.fat} / C {totals.carbs}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>今日のリマインド</h2>
                <p>{pendingTodayRoutines.length}件の未完了</p>
              </div>
              {todayRoutines.length === 0 ? (
                <p className="empty-state">今日は予定されているルーティーンがありません。</p>
              ) : (
                <div className="summary-stack">
                  {todayRoutines.slice(0, 4).map((routine) => (
                    <article key={routine.id} className={routine.completedForDate === today ? "mini-card is-done" : "mini-card"}>
                      <div className="mini-card__head">
                        <h3>{routine.name}</h3>
                        <span className={routine.completedForDate === today ? "pill success" : "pill"}>
                          {routine.completedForDate === today ? "完了" : "未完了"}
                        </span>
                      </div>
                      <p className="meta-row">
                        {routine.category} / {getFrequencyLabel(routine.frequencyType, routine.interval)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>我慢ログの目標進捗</h2>
              </div>
              <div className="goal-stack">
                <article className="goal-card">
                  <div className="mini-card__head">
                    <div>
                      <p className="goal-eyebrow">欲しいもの</p>
                      <h3>{moneyGoalCard.name}</h3>
                    </div>
                    <span className="pill money">{moneyGoalCard.priority}</span>
                  </div>
                  <p className="meta-row">{moneyGoalCard.status}</p>
                  <div className="progress-track"><div className="progress-fill money-fill" style={{ width: `${moneyGoalCard.progress}%` }} /></div>
                  <div className="progress-stats">
                    <span>{moneyGoalCard.saved}</span>
                    <span>{moneyGoalCard.remaining}</span>
                  </div>
                </article>
                <article className="goal-card">
                  <div className="mini-card__head">
                    <div>
                      <p className="goal-eyebrow">食べたいもの</p>
                      <h3>{calorieGoalCard.name}</h3>
                    </div>
                    <span className="pill calorie">{calorieGoalCard.priority}</span>
                  </div>
                  <p className="meta-row">{calorieGoalCard.status}</p>
                  <div className="progress-track"><div className="progress-fill calorie-fill" style={{ width: `${calorieGoalCard.progress}%` }} /></div>
                  <div className="progress-stats">
                    <span>{calorieGoalCard.saved}</span>
                    <span>{calorieGoalCard.remaining}</span>
                  </div>
                </article>
              </div>
            </section>
          </>
        )}

        {activeTab === "meals" && (
          <>
            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>食事を記録する</h2>
                <p>{formatDate(selectedMealDate)}</p>
              </div>
              <div className="form-grid">
                <label>
                  <span>記録日</span>
                  <input type="date" value={selectedMealDate} onChange={(event) => setSelectedMealDate(event.target.value)} />
                </label>
                <label>
                  <span>食事区分</span>
                  <select value={selectedMealKey} onChange={(event) => setSelectedMealKey(event.target.value)}>
                    {MEAL_KEYS.map((mealKey) => (
                      <option key={mealKey} value={mealKey}>
                        {MEAL_LABELS[mealKey]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="section-heading subheading">
                <h3>ワンタップで記録</h3>
                <p>{MEAL_LABELS[selectedMealKey]} に追加</p>
              </div>
              <div className="chip-group-block">
                <div className="chip-section">
                  <p className="list-label">食事セットをワンタップで記録</p>
                  <div className="chip-grid">
                    {state.meal.mealSets.map((mealSet) => (
                      <button
                        key={mealSet.id}
                        className="chip-button"
                        type="button"
                        onClick={() => addSetToMeal(mealSet)}
                      >
                        <span>{mealSet.name}</span>
                        <small>{mealSet.foodIds.length}品を追加</small>
                      </button>
                    ))}
                  </div>
                </div>
                {groupedFoods.map((group) => (
                  <div key={group.category} className="chip-section">
                    <p className="list-label">{group.category} をワンタップで記録</p>
                    <div className="chip-grid">
                      {group.foods.map((food) => (
                        <FoodChip key={food.id} food={food} onClick={() => addFoodToMeal(food)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>追加セクション</h2>
                <p>必要なときだけ展開</p>
              </div>
              <div className="inline-actions manage-toggle-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setShowFoodForm((current) => !current);
                    if (showMealSetForm) setShowMealSetForm(false);
                  }}
                >
                  {showFoodForm ? "固定メニュー追加を閉じる" : "固定メニュー追加"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setShowMealSetForm((current) => !current);
                    if (showFoodForm) setShowFoodForm(false);
                  }}
                >
                  {showMealSetForm ? "食事セット追加を閉じる" : "食事セット追加"}
                </button>
              </div>
              {showFoodForm && (
                <form className="form-grid meal-manage-form" onSubmit={saveFood}>
                  <label className="form-grid__full">
                    <span>メニュー名</span>
                    <input type="text" value={foodForm.name} onChange={(event) => setFoodForm({ ...foodForm, name: event.target.value })} placeholder="例: サラダチキン" />
                  </label>
                  <label>
                    <span>カロリー</span>
                    <input type="number" min="0" value={foodForm.calories} onChange={(event) => setFoodForm({ ...foodForm, calories: event.target.value })} />
                  </label>
                  <label>
                    <span>カテゴリ</span>
                    <select value={foodForm.category} onChange={(event) => setFoodForm({ ...foodForm, category: event.target.value })}>
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>たんぱく質</span>
                    <input type="number" min="0" value={foodForm.protein} onChange={(event) => setFoodForm({ ...foodForm, protein: event.target.value })} />
                  </label>
                  <label>
                    <span>脂質</span>
                    <input type="number" min="0" value={foodForm.fat} onChange={(event) => setFoodForm({ ...foodForm, fat: event.target.value })} />
                  </label>
                  <label className="form-grid__full">
                    <span>炭水化物</span>
                    <input type="number" min="0" value={foodForm.carbs} onChange={(event) => setFoodForm({ ...foodForm, carbs: event.target.value })} />
                  </label>
                  <div className="form-grid__full inline-actions">
                    <button className="primary-button" type="submit">{foodForm.id ? "固定メニューを更新" : "固定メニューを追加"}</button>
                    <button className="ghost-button" type="button" onClick={resetFoodForm}>閉じる</button>
                  </div>
                </form>
              )}
              {showMealSetForm && (
                <form className="summary-stack meal-manage-form" onSubmit={saveMealSet}>
                  <label>
                    <span>セット名</span>
                    <input type="text" value={mealSetForm.name} onChange={(event) => setMealSetForm({ ...mealSetForm, name: event.target.value })} placeholder="例: 朝の定番" />
                  </label>
                  <div className="selector-grid">
                    {state.meal.foods.map((food) => (
                      <label key={food.id} className="selector-item">
                        <input
                          type="checkbox"
                          checked={mealSetForm.foodIds.includes(food.id)}
                          onChange={() => toggleFoodInSet(food.id)}
                        />
                        <span>{food.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button className="primary-button" type="submit">{mealSetForm.id ? "食事セットを更新" : "食事セットを追加"}</button>
                    <button className="ghost-button" type="button" onClick={resetMealSetForm}>閉じる</button>
                  </div>
                </form>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>自由入力</h2>
              </div>
              <form className="form-grid" onSubmit={addFreeMealEntry}>
                <label className="form-grid__full">
                  <span>内容</span>
                  <input type="text" value={freeMealForm.name} onChange={(event) => setFreeMealForm({ ...freeMealForm, name: event.target.value })} placeholder="例: バナナヨーグルト" />
                </label>
                <label>
                  <span>カロリー</span>
                  <input type="number" min="0" value={freeMealForm.calories} onChange={(event) => setFreeMealForm({ ...freeMealForm, calories: event.target.value })} />
                </label>
                <label>
                  <span>カテゴリ</span>
                  <select value={freeMealForm.category} onChange={(event) => setFreeMealForm({ ...freeMealForm, category: event.target.value })}>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>たんぱく質</span>
                  <input type="number" min="0" value={freeMealForm.protein} onChange={(event) => setFreeMealForm({ ...freeMealForm, protein: event.target.value })} />
                </label>
                <label>
                  <span>脂質</span>
                  <input type="number" min="0" value={freeMealForm.fat} onChange={(event) => setFreeMealForm({ ...freeMealForm, fat: event.target.value })} />
                </label>
                <label className="form-grid__full">
                  <span>炭水化物</span>
                  <input type="number" min="0" value={freeMealForm.carbs} onChange={(event) => setFreeMealForm({ ...freeMealForm, carbs: event.target.value })} />
                </label>
                <button className="primary-button form-grid__full" type="submit">自由入力で追加</button>
              </form>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>{formatDate(selectedMealDate)} の記録</h2>
                <p>タップで詳細を展開</p>
              </div>
              <div className="summary-stack">
                {MEAL_KEYS.map((mealKey) => {
                  const items = mealRecord[mealKey];
                  return (
                    <MealRecordAccordion
                      key={mealKey}
                      label={MEAL_LABELS[mealKey]}
                      items={items}
                      isExpanded={expandedMeals[mealKey]}
                      onToggle={() =>
                        setExpandedMeals((current) => ({
                          ...current,
                          [mealKey]: !current[mealKey],
                        }))
                      }
                      onRemoveEntry={(entryId) => removeMealEntry(selectedMealDate, mealKey, entryId)}
                    />
                  );
                })}
              </div>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>履歴カレンダー</h2>
                <div className="month-switch">
                  <button className="secondary-button" type="button" onClick={() => setMealHistoryMonth(new Date(mealHistoryMonth.getFullYear(), mealHistoryMonth.getMonth() - 1, 1))}>前月</button>
                  <p>{formatMonthLabel(mealHistoryMonth)}</p>
                  <button className="secondary-button" type="button" onClick={() => setMealHistoryMonth(new Date(mealHistoryMonth.getFullYear(), mealHistoryMonth.getMonth() + 1, 1))}>次月</button>
                </div>
              </div>
              <div className="calendar-grid">
                {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                  <span key={day} className="weekday">{day}</span>
                ))}
                {mealCalendarDays.map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} className="calendar-day is-empty" />;
                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const entry = mealHistoryByDate[dateKey];
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={mealHistoryDate === dateKey ? "calendar-day is-selected" : "calendar-day"}
                      onClick={() => setMealHistoryDate(dateKey)}
                    >
                      <span>{date.getDate()}</span>
                      <small>{entry ? `${entry.totals.calories}kcal` : "-"}</small>
                    </button>
                  );
                })}
              </div>
              <div className="history-detail">
                <h3>{formatDate(mealHistoryDate)} の食事</h3>
                {!selectedMealHistoryEntry && <p className="empty-state">この日の記録はありません。</p>}
                {selectedMealHistoryEntry && (
                  <div className="summary-stack">
                    {MEAL_KEYS.map((mealKey) => {
                      const items = selectedMealHistoryEntry.meals[mealKey];
                      if (items.length === 0) return null;
                      return (
                        <article key={mealKey} className="mini-card">
                          <div className="mini-card__head">
                            <h3>{MEAL_LABELS[mealKey]}</h3>
                            <span className="pill">{items.length}件</span>
                          </div>
                          <p className="meta-row">{items.map((item) => item.name).join(" / ")}</p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>一覧管理</h2>
                <p>必要なときだけ展開</p>
              </div>
              <div className="inline-actions manage-toggle-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowFoodList((current) => !current)}
                >
                  {showFoodList ? "固定メニュー一覧を閉じる" : "固定メニュー一覧"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowMealSetList((current) => !current)}
                >
                  {showMealSetList ? "食事セット一覧を閉じる" : "食事セット一覧"}
                </button>
              </div>
              <div className="summary-stack manage-list-block">
                {showFoodList && (
                  <div>
                  <p className="list-label">固定メニュー一覧</p>
                  <div className="manage-grid">
                    {state.meal.foods.map((food) => (
                      <FoodManageCard
                        key={food.id}
                        food={food}
                        onAdd={() => addFoodToMeal(food)}
                        onEdit={() => startEditFood(food)}
                        onDelete={() => deleteFood(food.id)}
                      />
                    ))}
                  </div>
                  </div>
                )}
                {showMealSetList && (
                  <div>
                  <p className="list-label">食事セット一覧</p>
                  <div className="summary-stack">
                    {state.meal.mealSets.map((mealSet) => (
                      <MealSetCard
                        key={mealSet.id}
                        mealSet={mealSet}
                        foodsById={foodsById}
                        onAdd={() => addSetToMeal(mealSet)}
                        onEdit={() => startEditMealSet(mealSet)}
                        onDelete={() => deleteMealSet(mealSet.id)}
                      />
                    ))}
                  </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === "routines" && (
          <>
            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>今日の予定</h2>
              </div>
              <div className="summary-stack two-cols">
                <article className="goal-card">
                  <div className="section-heading">
                    <h3>未完了</h3>
                    <p>{pendingTodayRoutines.length}件</p>
                  </div>
                  {pendingTodayRoutines.length === 0 && <p className="empty-state">今日の未完了タスクはありません。</p>}
                  {pendingTodayRoutines.map((routine) => (
                    <label key={routine.id} className="check-item">
                      <input type="checkbox" checked={false} onChange={() => completeRoutine(routine.id)} />
                      <span className="check-copy">
                        <span className="record-card__title">{routine.name}</span>
                        <span className="record-card__meta">
                          {routine.category} / {getFrequencyLabel(routine.frequencyType, routine.interval)}
                        </span>
                      </span>
                    </label>
                  ))}
                </article>
                <article className="goal-card">
                  <div className="section-heading">
                    <h3>完了済み</h3>
                    <p>{completedTodayRoutines.length}件</p>
                  </div>
                  {completedTodayRoutines.length === 0 && <p className="empty-state">完了済みはまだありません。</p>}
                  {completedTodayRoutines.map((routine) => (
                    <label key={routine.id} className="check-item is-checked">
                      <input type="checkbox" checked onChange={() => uncompleteRoutine(routine.id)} />
                      <span className="check-copy">
                        <span className="record-card__title">{routine.name}</span>
                        <span className="record-card__meta">
                          次回予定日: {formatDate(routine.nextDueDate)}
                        </span>
                      </span>
                    </label>
                  ))}
                </article>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>ルーティーン追加</h2>
              </div>
              <form className="form-grid" onSubmit={handleAddRoutine}>
                <label className="form-grid__full">
                  <span>ルーティーン名</span>
                  <input type="text" value={routineForm.name} onChange={(event) => setRoutineForm({ ...routineForm, name: event.target.value })} placeholder="例: 朝のサプリ、洗面台の掃除" />
                </label>
                <label>
                  <span>カテゴリ</span>
                  <select value={routineForm.category} onChange={(event) => setRoutineForm({ ...routineForm, category: event.target.value })}>
                    {ROUTINE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>頻度</span>
                  <select value={routineForm.frequencyType} onChange={(event) => setRoutineForm({ ...routineForm, frequencyType: event.target.value })}>
                    {FREQUENCY_TYPES.map((type) => (
                      <option key={type} value={type}>{type === "毎日" ? "毎日" : `○${type}`}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>間隔</span>
                  <input type="number" min="1" value={routineForm.interval} disabled={routineForm.frequencyType === "毎日"} onChange={(event) => setRoutineForm({ ...routineForm, interval: Number(event.target.value) })} />
                </label>
                <label>
                  <span>開始日</span>
                  <input type="date" value={routineForm.startDate} onChange={(event) => setRoutineForm({ ...routineForm, startDate: event.target.value })} />
                </label>
                <button className="primary-button form-grid__full" type="submit">ルーティーンを追加</button>
              </form>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>登録済みルーティーン</h2>
              </div>
              <div className="record-list">
                {state.routines.length === 0 && <p className="empty-state">まだルーティーンがありません。</p>}
                {[...state.routines]
                  .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
                  .map((routine) => (
                    <article key={routine.id} className="record-card">
                      <div className="record-card__body">
                        <p className="record-card__title">{routine.name}</p>
                        <p className="record-card__meta">
                          {routine.category} / {getFrequencyLabel(routine.frequencyType, routine.interval)}
                        </p>
                        <p className="record-card__text">次回予定日: {formatDate(routine.nextDueDate)}</p>
                      </div>
                      <div className="action-stack">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            routine.completedForDate === today
                              ? uncompleteRoutine(routine.id)
                              : completeRoutine(routine.id)
                          }
                        >
                          {routine.completedForDate === today ? "未完了に戻す" : "完了"}
                        </button>
                        <button type="button" className="ghost-button" onClick={() => deleteRoutine(routine.id)}>削除</button>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "save" && (
          <>
            <section className="panel panel--highlight stats">
              <article className="stat-card stat-card--compact">
                <span>今日のセーブ金額</span>
                <strong>¥{todaySavedMoney.toLocaleString("ja-JP")}</strong>
                <small>累計 ¥{totalSavedMoney.toLocaleString("ja-JP")}</small>
              </article>
              <article className="stat-card stat-card--compact">
                <span>今日のセーブカロリー</span>
                <strong>{todaySavedCalories.toLocaleString("ja-JP")} kcal</strong>
                <small>累計 {totalSavedCalories.toLocaleString("ja-JP")} kcal</small>
              </article>
              <article className="stat-card stat-card--compact">
                <span>記録件数</span>
                <strong>{saveRecords.length} 件</strong>
                <small>毎日の我慢を見える化</small>
              </article>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>我慢ログを記録する</h2>
              </div>
              <form className="form-grid" onSubmit={addSaveRecord}>
                <label className="form-grid__full">
                  <span>我慢したもの</span>
                  <input type="text" value={saveRecordForm.itemName} onChange={(event) => setSaveRecordForm({ ...saveRecordForm, itemName: event.target.value })} placeholder="例: コンビニスイーツ" />
                </label>
                <label className="form-grid__full">
                  <span>入力タイプ</span>
                  <select value={saveRecordForm.entryType} onChange={(event) => setSaveRecordForm({ ...saveRecordForm, entryType: event.target.value, money: "", calories: "" })}>
                    <option value="money">お金だけ</option>
                    <option value="calorie">カロリーだけ</option>
                    <option value="both">お金＋カロリー</option>
                  </select>
                </label>
                {saveRecordForm.entryType !== "calorie" && (
                  <label>
                    <span>セーブ金額</span>
                    <input type="number" min="0" value={saveRecordForm.money} onChange={(event) => setSaveRecordForm({ ...saveRecordForm, money: event.target.value })} />
                  </label>
                )}
                {saveRecordForm.entryType !== "money" && (
                  <label>
                    <span>セーブカロリー</span>
                    <input type="number" min="0" value={saveRecordForm.calories} onChange={(event) => setSaveRecordForm({ ...saveRecordForm, calories: event.target.value })} />
                  </label>
                )}
                <label className="form-grid__full">
                  <span>メモ</span>
                  <textarea rows="3" value={saveRecordForm.memo} onChange={(event) => setSaveRecordForm({ ...saveRecordForm, memo: event.target.value })} placeholder="例: 仕事帰りに買わずに帰れた" />
                </label>
                <button className="primary-button form-grid__full" type="submit">保存する</button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>目標を追加する</h2>
              </div>
              <form className="form-grid" onSubmit={addGoal}>
                <label>
                  <span>目標タイプ</span>
                  <select value={goalForm.type} onChange={(event) => setGoalForm({ ...goalForm, type: event.target.value })}>
                    <option value="money">欲しいもの</option>
                    <option value="calorie">食べたいもの</option>
                  </select>
                </label>
                <label>
                  <span>優先度</span>
                  <select value={goalForm.priority} onChange={(event) => setGoalForm({ ...goalForm, priority: event.target.value })}>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </label>
                <label className="form-grid__full">
                  <span>目標名</span>
                  <input type="text" value={goalForm.name} onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })} placeholder={goalForm.type === "money" ? "例: 新しいイヤホン" : "例: チートデイのラーメン"} />
                </label>
                <label className="form-grid__full">
                  <span>目標値</span>
                  <input type="number" min="1" value={goalForm.target} onChange={(event) => setGoalForm({ ...goalForm, target: event.target.value })} placeholder={goalForm.type === "money" ? "12000" : "1800"} />
                </label>
                <button className="primary-button form-grid__full" type="submit">目標を追加する</button>
              </form>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>目標一覧</h2>
              </div>
              <div className="goal-list-wrap">
                {["money", "calorie"].map((type) => {
                  const goals = sortedGoals.filter((goal) => goal.type === type);
                  return (
                    <div key={type}>
                      <p className="list-label">{type === "money" ? "欲しいもの" : "食べたいもの"}</p>
                      <div className="summary-stack">
                        {goals.length === 0 && <p className="empty-state">まだ目標がありません。</p>}
                        {goals.map((goal) => (
                          <article key={goal.id} className="mini-card">
                            <div className="mini-card__head">
                              <div>
                                <h3>{goal.name}</h3>
                                <p className="meta-row">
                                  {type === "money" ? `¥${goal.target.toLocaleString("ja-JP")}` : `${goal.target.toLocaleString("ja-JP")} kcal`}
                                </p>
                              </div>
                              <button className="ghost-button" type="button" onClick={() => deleteGoal(goal.id)}>削除</button>
                            </div>
                            <p className="meta-row">優先度 {priorityLabel(goal.priority)}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel panel--highlight">
              <div className="section-heading">
                <h2>履歴カレンダー</h2>
                <div className="month-switch">
                  <button className="secondary-button" type="button" onClick={() => setSaveHistoryMonth(new Date(saveHistoryMonth.getFullYear(), saveHistoryMonth.getMonth() - 1, 1))}>前月</button>
                  <p>{formatMonthLabel(saveHistoryMonth)}</p>
                  <button className="secondary-button" type="button" onClick={() => setSaveHistoryMonth(new Date(saveHistoryMonth.getFullYear(), saveHistoryMonth.getMonth() + 1, 1))}>次月</button>
                </div>
              </div>
              <div className="calendar-grid">
                {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                  <span key={day} className="weekday">{day}</span>
                ))}
                {saveCalendarDays.map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} className="calendar-day is-empty" />;
                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const dayRecords = saveRecordsByDate[dateKey] || [];
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={saveHistoryDate === dateKey ? "calendar-day is-selected" : "calendar-day"}
                      onClick={() => setSaveHistoryDate(dateKey)}
                    >
                      <span>{date.getDate()}</span>
                      <small>
                        {dayRecords.length > 0
                          ? `¥${sumMoney(dayRecords).toLocaleString("ja-JP")} / ${sumCalories(dayRecords).toLocaleString("ja-JP")}k`
                          : "-"}
                      </small>
                    </button>
                  );
                })}
              </div>
              <div className="section-heading">
                <h3>{formatDate(saveHistoryDate)} の記録</h3>
                <button className="ghost-button" type="button" onClick={clearSaveRecords}>履歴を全削除</button>
              </div>
              <div className="record-list">
                {saveHistoryRecords.length === 0 && <p className="empty-state">この日の記録はありません。</p>}
                {saveHistoryRecords.map((record) => (
                  <article key={record.id} className="record-card">
                    <div className="record-card__body">
                      <p className="record-card__title">{record.itemName}</p>
                      <p className="record-card__meta">{record.date}</p>
                      <p className="record-card__text">
                        {record.money > 0 && `¥${record.money.toLocaleString("ja-JP")}`}
                        {record.money > 0 && record.calories > 0 && " / "}
                        {record.calories > 0 && `${record.calories.toLocaleString("ja-JP")} kcal`}
                      </p>
                      {record.memo && <p className="record-card__text">{record.memo}</p>}
                    </div>
                    <button type="button" className="ghost-button" onClick={() => deleteSaveRecord(record.id)}>削除</button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

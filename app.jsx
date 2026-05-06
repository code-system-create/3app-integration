const { useEffect, useMemo, useState } = React;

const STORAGE_KEY = "three-app-integration-state";

const mealTypes = ["朝食", "昼食", "夕食", "間食"];
const cravingTypes = ["お菓子", "夜更かし", "衝動買い", "SNS", "その他"];
const tabs = [
  { id: "home", label: "ホーム" },
  { id: "meals", label: "食事記録" },
  { id: "reminders", label: "リマインド" },
  { id: "resist", label: "我慢ログ" },
];

const nowLocal = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};
const today = () => nowLocal().slice(0, 10);

function parseDateValue(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { meals: [], reminders: [], resistLogs: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      resistLogs: Array.isArray(parsed.resistLogs) ? parsed.resistLogs : [],
    };
  } catch (error) {
    console.error("Failed to load local data:", error);
    return { meals: [], reminders: [], resistLogs: [] };
  }
}

function formatDate(value) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parseDateValue(value));
}

function formatDateTime(value) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseDateValue(value));
}

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [state, setState] = useState(loadState);
  const [mealForm, setMealForm] = useState({
    date: today(),
    type: mealTypes[0],
    title: "",
    note: "",
  });
  const [reminderForm, setReminderForm] = useState({
    title: "",
    dueAt: nowLocal(),
    detail: "",
  });
  const [resistForm, setResistForm] = useState({
    date: today(),
    type: cravingTypes[0],
    level: 3,
    minutes: 10,
    memo: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sortedMeals = useMemo(
    () =>
      [...state.meals].sort((a, b) => {
        return parseDateValue(b.date) - parseDateValue(a.date);
      }),
    [state.meals]
  );

  const sortedReminders = useMemo(
    () =>
      [...state.reminders].sort((a, b) => {
        if (a.done !== b.done) return a.done - b.done;
        return parseDateValue(a.dueAt) - parseDateValue(b.dueAt);
      }),
    [state.reminders]
  );

  const sortedResistLogs = useMemo(
    () =>
      [...state.resistLogs].sort((a, b) => {
        return parseDateValue(b.date) - parseDateValue(a.date);
      }),
    [state.resistLogs]
  );

  const upcomingCount = sortedReminders.filter((item) => !item.done).length;
  const totalResistMinutes = sortedResistLogs.reduce(
    (sum, item) => sum + Number(item.minutes || 0),
    0
  );

  function addMeal(event) {
    event.preventDefault();
    if (!mealForm.title.trim()) return;

    const entry = {
      id: crypto.randomUUID(),
      ...mealForm,
      title: mealForm.title.trim(),
      note: mealForm.note.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      meals: [entry, ...current.meals],
    }));
    setMealForm({
      date: today(),
      type: mealTypes[0],
      title: "",
      note: "",
    });
  }

  function addReminder(event) {
    event.preventDefault();
    if (!reminderForm.title.trim()) return;

    const entry = {
      id: crypto.randomUUID(),
      title: reminderForm.title.trim(),
      dueAt: reminderForm.dueAt,
      detail: reminderForm.detail.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      reminders: [entry, ...current.reminders],
    }));
    setReminderForm({
      title: "",
      dueAt: nowLocal(),
      detail: "",
    });
  }

  function addResistLog(event) {
    event.preventDefault();
    const entry = {
      id: crypto.randomUUID(),
      ...resistForm,
      level: Number(resistForm.level),
      minutes: Number(resistForm.minutes),
      memo: resistForm.memo.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      resistLogs: [entry, ...current.resistLogs],
    }));
    setResistForm({
      date: today(),
      type: cravingTypes[0],
      level: 3,
      minutes: 10,
      memo: "",
    });
  }

  function removeItem(collection, id) {
    setState((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  }

  function toggleReminder(id) {
    setState((current) => ({
      ...current,
      reminders: current.reminders.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    }));
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="hero__eyebrow">3 APP INTEGRATION</p>
        <h1>毎日の記録をひとつにまとめる</h1>
        <p className="hero__copy">
          食事記録、リマインド、我慢ログを一つの画面で管理できます。
        </p>
      </header>

      <nav className="tab-bar" aria-label="機能切り替え">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content-grid">
        {activeTab === "home" && (
          <>
            <section className="panel panel--highlight stats">
              <div className="stat-card">
                <span>食事記録</span>
                <strong>{state.meals.length}</strong>
                <small>保存済みの記録</small>
              </div>
              <div className="stat-card">
                <span>未完了リマインド</span>
                <strong>{upcomingCount}</strong>
                <small>やることを見逃さない</small>
              </div>
              <div className="stat-card">
                <span>我慢できた時間</span>
                <strong>{totalResistMinutes}分</strong>
                <small>積み上げを見える化</small>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>直近の食事記録</h2>
              </div>
              {sortedMeals.slice(0, 3).map((meal) => (
                <article key={meal.id} className="list-card">
                  <div>
                    <p className="list-card__title">
                      {meal.type} / {meal.title}
                    </p>
                    <p className="list-card__meta">{formatDate(meal.date)}</p>
                  </div>
                  {meal.note && <p className="list-card__text">{meal.note}</p>}
                </article>
              ))}
              {sortedMeals.length === 0 && (
                <p className="empty-state">まだ食事記録はありません。</p>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>直近のリマインド</h2>
              </div>
              {sortedReminders.slice(0, 3).map((reminder) => (
                <article key={reminder.id} className="list-card">
                  <div>
                    <p className="list-card__title">{reminder.title}</p>
                    <p className="list-card__meta">
                      {formatDateTime(reminder.dueAt)}
                    </p>
                  </div>
                  <span className={reminder.done ? "badge done" : "badge"}>
                    {reminder.done ? "完了" : "予定あり"}
                  </span>
                </article>
              ))}
              {sortedReminders.length === 0 && (
                <p className="empty-state">まだリマインドはありません。</p>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>直近の我慢ログ</h2>
              </div>
              {sortedResistLogs.slice(0, 3).map((log) => (
                <article key={log.id} className="list-card">
                  <div>
                    <p className="list-card__title">{log.type}</p>
                    <p className="list-card__meta">
                      {formatDate(log.date)} / 強さ {log.level} / {log.minutes}分
                    </p>
                  </div>
                  {log.memo && <p className="list-card__text">{log.memo}</p>}
                </article>
              ))}
              {sortedResistLogs.length === 0 && (
                <p className="empty-state">まだ我慢ログはありません。</p>
              )}
            </section>
          </>
        )}

        {activeTab === "meals" && (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>食事を記録する</h2>
              </div>
              <form className="form-grid" onSubmit={addMeal}>
                <label>
                  <span>日付</span>
                  <input
                    type="date"
                    value={mealForm.date}
                    onChange={(event) =>
                      setMealForm({ ...mealForm, date: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>区分</span>
                  <select
                    value={mealForm.type}
                    onChange={(event) =>
                      setMealForm({ ...mealForm, type: event.target.value })
                    }
                  >
                    {mealTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-grid__full">
                  <span>内容</span>
                  <input
                    type="text"
                    placeholder="例: 鮭おにぎりと味噌汁"
                    value={mealForm.title}
                    onChange={(event) =>
                      setMealForm({ ...mealForm, title: event.target.value })
                    }
                  />
                </label>
                <label className="form-grid__full">
                  <span>メモ</span>
                  <textarea
                    rows="3"
                    placeholder="量や気づきがあれば記録"
                    value={mealForm.note}
                    onChange={(event) =>
                      setMealForm({ ...mealForm, note: event.target.value })
                    }
                  />
                </label>
                <button className="primary-button form-grid__full" type="submit">
                  食事記録を追加
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>記録一覧</h2>
              </div>
              {sortedMeals.map((meal) => (
                <article key={meal.id} className="record-card">
                  <div className="record-card__body">
                    <p className="record-card__title">
                      {meal.type} / {meal.title}
                    </p>
                    <p className="record-card__meta">{formatDate(meal.date)}</p>
                    {meal.note && <p className="record-card__text">{meal.note}</p>}
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeItem("meals", meal.id)}
                  >
                    削除
                  </button>
                </article>
              ))}
              {sortedMeals.length === 0 && (
                <p className="empty-state">食事記録を追加するとここに表示されます。</p>
              )}
            </section>
          </>
        )}

        {activeTab === "reminders" && (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>リマインドを追加する</h2>
              </div>
              <form className="form-grid" onSubmit={addReminder}>
                <label className="form-grid__full">
                  <span>タイトル</span>
                  <input
                    type="text"
                    placeholder="例: 薬を飲む"
                    value={reminderForm.title}
                    onChange={(event) =>
                      setReminderForm({
                        ...reminderForm,
                        title: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>日時</span>
                  <input
                    type="datetime-local"
                    value={reminderForm.dueAt}
                    onChange={(event) =>
                      setReminderForm({
                        ...reminderForm,
                        dueAt: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="form-grid__full">
                  <span>詳細</span>
                  <textarea
                    rows="3"
                    placeholder="補足メモがあれば入力"
                    value={reminderForm.detail}
                    onChange={(event) =>
                      setReminderForm({
                        ...reminderForm,
                        detail: event.target.value,
                      })
                    }
                  />
                </label>
                <button className="primary-button form-grid__full" type="submit">
                  リマインドを追加
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>リマインド一覧</h2>
              </div>
              {sortedReminders.map((reminder) => (
                <article
                  key={reminder.id}
                  className={reminder.done ? "record-card is-done" : "record-card"}
                >
                  <div className="record-card__body">
                    <p className="record-card__title">{reminder.title}</p>
                    <p className="record-card__meta">
                      {formatDateTime(reminder.dueAt)}
                    </p>
                    {reminder.detail && (
                      <p className="record-card__text">{reminder.detail}</p>
                    )}
                  </div>
                  <div className="record-card__actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => toggleReminder(reminder.id)}
                    >
                      {reminder.done ? "未完了に戻す" : "完了にする"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeItem("reminders", reminder.id)}
                    >
                      削除
                    </button>
                  </div>
                </article>
              ))}
              {sortedReminders.length === 0 && (
                <p className="empty-state">リマインドを追加するとここに表示されます。</p>
              )}
            </section>
          </>
        )}

        {activeTab === "resist" && (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>我慢ログを追加する</h2>
              </div>
              <form className="form-grid" onSubmit={addResistLog}>
                <label>
                  <span>日付</span>
                  <input
                    type="date"
                    value={resistForm.date}
                    onChange={(event) =>
                      setResistForm({ ...resistForm, date: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>種類</span>
                  <select
                    value={resistForm.type}
                    onChange={(event) =>
                      setResistForm({ ...resistForm, type: event.target.value })
                    }
                  >
                    {cravingTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>衝動の強さ</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={resistForm.level}
                    onChange={(event) =>
                      setResistForm({ ...resistForm, level: event.target.value })
                    }
                  />
                  <small>{resistForm.level} / 5</small>
                </label>
                <label>
                  <span>我慢できた時間</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={resistForm.minutes}
                    onChange={(event) =>
                      setResistForm({ ...resistForm, minutes: event.target.value })
                    }
                  />
                </label>
                <label className="form-grid__full">
                  <span>メモ</span>
                  <textarea
                    rows="3"
                    placeholder="どんな状況だったか記録"
                    value={resistForm.memo}
                    onChange={(event) =>
                      setResistForm({ ...resistForm, memo: event.target.value })
                    }
                  />
                </label>
                <button className="primary-button form-grid__full" type="submit">
                  我慢ログを追加
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>ログ一覧</h2>
              </div>
              {sortedResistLogs.map((log) => (
                <article key={log.id} className="record-card">
                  <div className="record-card__body">
                    <p className="record-card__title">{log.type}</p>
                    <p className="record-card__meta">
                      {formatDate(log.date)} / 強さ {log.level} / {log.minutes}分
                    </p>
                    {log.memo && <p className="record-card__text">{log.memo}</p>}
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeItem("resistLogs", log.id)}
                  >
                    削除
                  </button>
                </article>
              ))}
              {sortedResistLogs.length === 0 && (
                <p className="empty-state">我慢ログを追加するとここに表示されます。</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

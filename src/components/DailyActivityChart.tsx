import { addNewZealandDays, nzParts, nzStartOfDay } from "@/lib/timezone";

type DayActivity = {
  study: number;
  extracurricular: number;
  sleep: number;
};

// Demo activity gives the dashboard a useful shape until calendar and session
// data are expanded to record sleep and extracurricular commitments.
const DEMO_ACTIVITY: DayActivity[] = [
  { study: 3.5, extracurricular: 1.5, sleep: 7 },
  { study: 4.5, extracurricular: 2, sleep: 6.5 },
  { study: 2.5, extracurricular: 3, sleep: 8 },
  { study: 5, extracurricular: 1, sleep: 6 },
  { study: 3, extracurricular: 2.5, sleep: 7.5 },
  { study: 2, extracurricular: 4, sleep: 8 },
  { study: 3.5, extracurricular: 2, sleep: 5 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_HOURS = 16;

export function DailyActivityChart() {
  const now = new Date();
  const today = nzParts(now);
  const monday = addNewZealandDays(nzStartOfDay(now), -((today.weekday + 6) % 7));
  const days = DEMO_ACTIVITY.map((activity, index) => {
    const date = addNewZealandDays(monday, index);
    const parts = nzParts(date);
    return { ...activity, label: DAY_NAMES[parts.weekday], isToday: parts.weekday === today.weekday };
  });

  return (
    <section className="card p-6" aria-labelledby="daily-activity-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">This week</p>
          <h2 id="daily-activity-title" className="mt-1 text-lg font-bold">Daily rhythm</h2>
          <p className="mt-0.5 text-sm text-muted">A demo view of how your hours are spent.</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-faint">Hours</span>
      </div>

      <div className="mt-5 flex h-44 items-end gap-2 border-b border-line-soft pb-1" role="img" aria-label="Weekly chart showing daily study, extracurricular, and sleep hours">
        {days.map((day) => {
          const total = day.study + day.extracurricular + day.sleep;
          return (
            <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-32 w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-lg bg-surface-2" title={`${day.label}: ${day.study}h study, ${day.extracurricular}h extracurricular, ${day.sleep}h sleep`}>
                <div className="bg-moss" style={{ height: `${(day.study / MAX_HOURS) * 100}%` }} />
                <div className="bg-citrus" style={{ height: `${(day.extracurricular / MAX_HOURS) * 100}%` }} />
                <div className="bg-indigo-300 dark:bg-indigo-400" style={{ height: `${(day.sleep / MAX_HOURS) * 100}%` }} />
              </div>
              <span className={`text-[10px] font-bold ${day.isToday ? "text-moss" : "text-faint"}`}>{day.label}</span>
              <span className="sr-only">{total} total hours</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        <Legend color="bg-moss" label="Study" />
        <Legend color="bg-citrus" label="Extra-curricular" />
        <Legend color="bg-indigo-300 dark:bg-indigo-400" label="Sleep (4–8h)" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>;
}

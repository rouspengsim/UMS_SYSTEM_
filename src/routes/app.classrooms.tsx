import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { pageTitle } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TIMETABLE_CELL_PREFIX, decodeTimetableCell } from "@/lib/timetable-cell";
import { Building2, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/app/classrooms")({
  head: () => ({ meta: [{ title: pageTitle("Classrooms") }] }),
  component: ClassroomsPage,
});

type ClassroomStatus = "ល្អ" | "មធ្យម";
type ClassroomDevice = "Panasonic" | "Casio" | "Sony";

type Classroom = {
  no: number;
  building: string;
  room: string;
  device?: ClassroomDevice;
  status: ClassroomStatus;
  usedDate?: string;
  note?: string;
};

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type TimetableSlot = {
  id: string;
  day: Weekday;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_name?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  classes?: { name?: string | null; subject_code?: string | null } | null;
};

const CLASSROOMS: Classroom[] = [
  { no: 1, building: "អាគារ A", room: "A11", device: "Panasonic", status: "ល្អ" },
  { no: 2, building: "អាគារ A", room: "A21", device: "Panasonic", status: "ល្អ" },
  { no: 3, building: "អាគារ A", room: "A22", device: "Panasonic", status: "ល្អ" },
  { no: 4, building: "អាគារ A", room: "A23", device: "Panasonic", status: "ល្អ" },
  { no: 5, building: "អាគារ A", room: "A25", device: "Panasonic", status: "ល្អ" },
  { no: 6, building: "អាគារ A", room: "A30", device: "Casio", status: "មធ្យម" },
  { no: 7, building: "អាគារ A", room: "A31", device: "Sony", status: "មធ្យម" },
  { no: 8, building: "អាគារ A", room: "A32", device: "Panasonic", status: "ល្អ" },
  { no: 9, building: "អាគារ A", room: "A33", device: "Panasonic", status: "ល្អ" },
  { no: 10, building: "អាគារ A", room: "A34", device: "Casio", status: "មធ្យម" },
  { no: 11, building: "អាគារ A", room: "A35", device: "Casio", status: "មធ្យម" },
  { no: 12, building: "អាគារ A", room: "សាលA", device: "Casio", status: "មធ្យម" },
  { no: 13, building: "អាគារ B", room: "B11", device: "Casio", status: "មធ្យម" },
  { no: 14, building: "អាគារ B", room: "B12", device: "Casio", status: "មធ្យម" },
  { no: 15, building: "អាគារ B", room: "B13", device: "Casio", status: "មធ្យម" },
  { no: 16, building: "អាគារ B", room: "B16", device: "Casio", status: "មធ្យម" },
  { no: 17, building: "អាគារ B", room: "B17", device: "Casio", status: "មធ្យម" },
  { no: 18, building: "អាគារ B", room: "B18", device: "Casio", status: "មធ្យម" },
  { no: 19, building: "អាគារ B", room: "B21", device: "Casio", status: "មធ្យម" },
  { no: 20, building: "អាគារ B", room: "B25", device: "Casio", status: "មធ្យម" },
  { no: 21, building: "អាគារ B", room: "B26", device: "Casio", status: "មធ្យម" },
  { no: 22, building: "អាគារ B", room: "B27", device: "Casio", status: "មធ្យម" },
  { no: 23, building: "អាគារ B", room: "B28", device: "Casio", status: "មធ្យម" },
  { no: 24, building: "អាគារ B", room: "B29", device: "Casio", status: "មធ្យម" },
  { no: 25, building: "អាគារ B", room: "B30", device: "Panasonic", status: "ល្អ" },
  { no: 26, building: "អាគារ B", room: "B30.1", device: "Casio", status: "មធ្យម" },
  { no: 27, building: "អាគារ B", room: "B30.2", device: "Casio", status: "មធ្យម" },
  { no: 28, building: "អាគារ B", room: "B30.3", device: "Casio", status: "មធ្យម" },
  { no: 29, building: "អាគារ B", room: "B30.4", device: "Casio", status: "មធ្យម" },
  { no: 30, building: "អាគារ B", room: "B31", device: "Casio", status: "មធ្យម" },
  { no: 31, building: "អាគារ B", room: "B32", device: "Casio", status: "មធ្យម" },
  { no: 32, building: "អាគារ B", room: "B33", device: "Casio", status: "មធ្យម" },
  { no: 33, building: "អាគារ B", room: "B34", device: "Casio", status: "មធ្យម" },
  { no: 34, building: "អាគារ B", room: "B35", device: "Casio", status: "មធ្យម" },
  { no: 35, building: "អាគារ B", room: "B36", device: "Casio", status: "មធ្យម" },
  { no: 36, building: "អាគារ B", room: "B37", device: "Casio", status: "មធ្យម" },
  { no: 37, building: "អាគារ B", room: "B38", device: "Casio", status: "មធ្យម" },
  { no: 38, building: "អាគារ B", room: "B39", device: "Casio", status: "មធ្យម" },
  { no: 39, building: "អាគារ C", room: "C21", device: "Panasonic", status: "ល្អ" },
  { no: 40, building: "អាគារ C", room: "C22", device: "Casio", status: "មធ្យម" },
  { no: 41, building: "អាគារ C", room: "C23", device: "Casio", status: "មធ្យម" },
  { no: 42, building: "អាគារ C", room: "C24", device: "Panasonic", status: "ល្អ" },
  { no: 43, building: "អាគារ C", room: "C25", device: "Panasonic", status: "ល្អ" },
  { no: 44, building: "អាគារ C", room: "C31", device: "Panasonic", status: "ល្អ" },
  { no: 45, building: "អាគារ C", room: "C32", device: "Panasonic", status: "ល្អ" },
  { no: 46, building: "អាគារ C", room: "C33", device: "Panasonic", status: "ល្អ" },
  { no: 47, building: "អាគារ C", room: "C34", device: "Casio", status: "មធ្យម" },
  { no: 48, building: "អាគារ C", room: "C35", device: "Panasonic", status: "ល្អ" },
  { no: 49, building: "អាគារ C", room: "C41", device: "Sony", status: "មធ្យម" },
  { no: 50, building: "អាគារ C", room: "C42", device: "Panasonic", status: "ល្អ" },
  { no: 51, building: "អាគារ C", room: "C43", device: "Panasonic", status: "ល្អ" },
  { no: 52, building: "អាគារ C", room: "C44", device: "Panasonic", status: "ល្អ" },
  { no: 53, building: "អាគារ C", room: "C45", device: "Casio", status: "មធ្យម" },
  { no: 54, building: "អាគារ C", room: "C46", device: "Panasonic", status: "ល្អ" },
  { no: 55, building: "អាគារ C", room: "C47", device: "Panasonic", status: "ល្អ" },
  { no: 56, building: "អាគារ D", room: "D31", device: "Casio", status: "មធ្យម" },
  { no: 57, building: "អាគារ D", room: "សាល D", device: "Casio", status: "មធ្យម" },
  { no: 58, building: "អាគារ E", room: "E1", device: "Casio", status: "មធ្យម" },
  { no: 59, building: "អាគារ E", room: "E2", device: "Casio", status: "មធ្យម" },
  { no: 60, building: "អាគារ E", room: "E3", device: "Casio", status: "មធ្យម" },
  { no: 61, building: "អាគារ E", room: "E4", device: "Casio", status: "មធ្យម" },
  { no: 62, building: "អាគារ E", room: "E5", device: "Casio", status: "មធ្យម" },
  { no: 63, building: "អាគារ E", room: "E6", device: "Casio", status: "មធ្យម" },
  { no: 64, building: "អាគារ E", room: "E7", device: "Casio", status: "មធ្យម" },
  { no: 65, building: "អាគារ F", room: "F13", device: "Casio", status: "មធ្យម" },
  { no: 66, building: "អាគារ F", room: "F14", device: "Casio", status: "មធ្យម" },
  { no: 67, building: "អាគារ F", room: "F15", device: "Casio", status: "មធ្យម" },
  { no: 68, building: "អាគារ F", room: "F31", device: "Casio", status: "មធ្យម" },
  { no: 69, building: "អាគារ F", room: "F33", device: "Casio", status: "មធ្យម" },
  { no: 70, building: "អាគារ F", room: "F34", device: "Panasonic", status: "ល្អ" },
  { no: 71, building: "អាគារ F", room: "F35", device: "Casio", status: "មធ្យម" },
  { no: 72, building: "អាគារ F", room: "F36", device: "Casio", status: "មធ្យម" },
  { no: 73, building: "អាគារ F", room: "F37", device: "Panasonic", status: "ល្អ" },
  { no: 74, building: "អាគារ G", room: "G22", device: "Panasonic", status: "ល្អ" },
  { no: 75, building: "អាគារ G", room: "G23", device: "Casio", status: "មធ្យម" },
  { no: 76, building: "អាគារ G", room: "G31", device: "Casio", status: "មធ្យម" },
  { no: 77, building: "អាគារ G", room: "G32", device: "Casio", status: "មធ្យម" },
  { no: 78, building: "អាគារ G", room: "G33", device: "Panasonic", status: "ល្អ" },
  { no: 79, building: "អាគារ G", room: "G41", device: "Casio", status: "មធ្យម" },
  { no: 80, building: "អាគារ G", room: "G42", device: "Panasonic", status: "ល្អ" },
  { no: 81, building: "អាគារ G", room: "G43", device: "Panasonic", status: "ល្អ" },
  { no: 82, building: "អាគារ G", room: "សាល G", device: "Panasonic", status: "ល្អ" },
  { no: 83, building: "អាគារ H", room: "H21", device: "Casio", status: "មធ្យម" },
  { no: 84, building: "អាគារ H", room: "H22", device: "Panasonic", status: "ល្អ" },
  { no: 85, building: "អាគារ H", room: "H23", device: "Casio", status: "មធ្យម" },
  { no: 86, building: "អាគារ H", room: "H31", device: "Panasonic", status: "ល្អ" },
  { no: 87, building: "អាគារ H", room: "H32", device: "Casio", status: "មធ្យម" },
  { no: 88, building: "អាគារ H", room: "H33", device: "Panasonic", status: "ល្អ" },
  { no: 89, building: "អាគារ H", room: "H41", device: "Casio", status: "មធ្យម" },
  { no: 90, building: "អាគារ H", room: "H42", device: "Sony", status: "មធ្យម" },
  { no: 91, building: "អាគារ H", room: "H43", device: "Panasonic", status: "ល្អ" },
  { no: 92, building: "អាគារ H", room: "សាល H", device: "Casio", status: "មធ្យម" },
  { no: 93, building: "អាគារ I", room: "I41", device: "Casio", status: "មធ្យម" },
];

const BUILDINGS = Array.from(new Set(CLASSROOMS.map((room) => room.building)));
const STATUSES: Array<"all" | ClassroomStatus> = ["all", "ល្អ", "មធ្យម"];
const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_RANGE_OPTIONS = [
  { value: "00:00-23:59", label: "All time" },
  { value: "07:30-09:00", label: "7:30 AM - 9:00 AM" },
  { value: "09:00-10:30", label: "9:00 AM - 10:30 AM" },
  { value: "10:30-12:00", label: "10:30 AM - 12:00 PM" },
  { value: "13:00-14:30", label: "1:00 PM - 2:30 PM" },
  { value: "14:30-16:00", label: "2:30 PM - 4:00 PM" },
  { value: "16:00-17:30", label: "4:00 PM - 5:30 PM" },
  { value: "17:30-19:00", label: "5:30 PM - 7:00 PM" },
  { value: "19:00-20:30", label: "7:00 PM - 8:30 PM" },
];
const DAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};
const DEMO_MANUAL_SCHEDULES_KEY = "studentsphere.manual.schedules";

type AvailabilityFilter = "all" | "free" | "busy";

function toKhmerDigits(value: number | string) {
  const digits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)]);
}

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function formatTime(value: string | null | undefined) {
  return value?.slice(0, 5) ?? "";
}

function normalizeRoom(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").trim().toUpperCase();
}

function decodedRoomName(value: string | null | undefined) {
  const rawValue = value ?? "";
  const payload = decodeTimetableCell(rawValue);
  if (payload.room?.trim()) return payload.room.trim();
  return rawValue.trimStart().startsWith(TIMETABLE_CELL_PREFIX) ? "" : rawValue.trim();
}

function overlapsTimeRange(
  slotStart: string | null | undefined,
  slotEnd: string | null | undefined,
  queryStart: string,
  queryEnd: string,
) {
  const start = formatTime(slotStart);
  const end = formatTime(slotEnd);
  return !!start && !!end && start < queryEnd && end > queryStart;
}

function ClassroomsPage() {
  const { t } = useI18n();
  const { isDemo } = useAuth();
  const [query, setQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ClassroomStatus>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => {
    const day = new Date().getDay();
    return day >= 1 && day <= 6 ? DAYS[day - 1] : "mon";
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGE_OPTIONS[0].value);
  const [startTime, endTime] = selectedTimeRange.split("-");
  const selectedTimeRangeLabel =
    TIME_RANGE_OPTIONS.find((option) => option.value === selectedTimeRange)?.label ??
    selectedTimeRange;

  const { data: timetableSlots = [], isLoading } = useQuery({
    queryKey: ["classroom-availability", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        type DemoSchedule = {
          className: string;
          rows: Array<{
            start: string;
            end: string;
            cells: Record<
              Weekday,
              { room?: string; subject?: string; subjectCode?: string; teacher?: string }
            >;
          }>;
        };
        return readDemoList<DemoSchedule>(DEMO_MANUAL_SCHEDULES_KEY).flatMap(
          (schedule, scheduleIndex) =>
            schedule.rows.flatMap((row, rowIndex) =>
              DAYS.flatMap((day) => {
                const cell = row.cells?.[day];
                if (!cell?.room?.trim()) return [];
                return [
                  {
                    id: `demo-${scheduleIndex}-${rowIndex}-${day}`,
                    day,
                    start_time: row.start,
                    end_time: row.end,
                    room: cell.room,
                    teacher_name: cell.teacher ?? null,
                    subject_code: cell.subjectCode ?? null,
                    subject_name: cell.subject ?? null,
                    classes: { name: schedule.className },
                  } satisfies TimetableSlot,
                ];
              }),
            ),
        );
      }

      const { data, error } = await supabase
        .from("timetable_slots")
        .select(
          "id,day,start_time,end_time,room,teacher_name,subject_code,subject_name,classes(name,subject_code)",
        )
        .order("day", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TimetableSlot[];
    },
  });

  const busySlots = useMemo(() => {
    return timetableSlots
      .filter(
        (slot) =>
          slot.day === selectedDay &&
          overlapsTimeRange(slot.start_time, slot.end_time, startTime, endTime),
      )
      .map((slot) => {
        const payload = decodeTimetableCell(slot.room);
        return {
          ...slot,
          roomName: decodedRoomName(slot.room),
          subjectName:
            slot.subject_name || payload.subject || slot.subject_code || payload.subjectCode || "",
          className: slot.classes?.name || "",
          teacherName: slot.teacher_name || payload.teacher || "",
        };
      })
      .filter((slot) => slot.roomName.trim());
  }, [endTime, selectedDay, startTime, timetableSlots]);

  const busyRooms = useMemo(
    () => new Set(busySlots.map((slot) => normalizeRoom(slot.roomName))),
    [busySlots],
  );

  const busyInventoryCount = useMemo(
    () => CLASSROOMS.filter((room) => busyRooms.has(normalizeRoom(room.room))).length,
    [busyRooms],
  );

  const filteredRooms = useMemo(() => {
    const term = query.trim().toLowerCase();
    return CLASSROOMS.filter((room) => {
      const isBusy = busyRooms.has(normalizeRoom(room.room));
      if (buildingFilter !== "all" && room.building !== buildingFilter) return false;
      if (statusFilter !== "all" && room.status !== statusFilter) return false;
      if (availabilityFilter === "free" && isBusy) return false;
      if (availabilityFilter === "busy" && !isBusy) return false;
      if (!term) return true;
      return [room.building, room.room, room.status, room.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [availabilityFilter, buildingFilter, busyRooms, query, statusFilter]);

  const statusSummary = useMemo(
    () => ({
      good: CLASSROOMS.filter((room) => room.status === "ល្អ").length,
      medium: CLASSROOMS.filter((room) => room.status === "មធ្យម").length,
    }),
    [],
  );

  return (
    <div>
      <PageHeader title={t("classrooms")} subtitle={t("classrooms_subtitle")} />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <SummaryCard label={t("total_rooms")} value={CLASSROOMS.length} />
        <SummaryCard label={t("free_rooms")} value={CLASSROOMS.length - busyInventoryCount} />
        <SummaryCard label={t("busy_rooms")} value={busyInventoryCount} />
        <SummaryCard label={t("good_status")} value={statusSummary.good} />
      </div>

      <SectionCard className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(130px,190px))]">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("search")}
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search_classrooms")}
                className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </label>
          <Select
            label={t("day")}
            value={selectedDay}
            onChange={(value) => setSelectedDay(value as Weekday)}
            options={DAYS.map((day) => ({ value: day, label: DAY_LABELS[day] }))}
          />
          <Select
            label={t("time")}
            value={selectedTimeRange}
            onChange={setSelectedTimeRange}
            options={TIME_RANGE_OPTIONS}
          />
          <Select
            label={t("building")}
            value={buildingFilter}
            onChange={setBuildingFilter}
            options={[
              { value: "all", label: t("all") },
              ...BUILDINGS.map((building) => ({ value: building, label: building })),
            ]}
          />
          <Select
            label={t("availability")}
            value={availabilityFilter}
            onChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}
            options={[
              { value: "all", label: t("all") },
              { value: "free", label: t("free") },
              { value: "busy", label: t("busy") },
            ]}
          />
          <Select
            label={t("condition")}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "all" | ClassroomStatus)}
            options={STATUSES.map((status) => ({
              value: status,
              label: status === "all" ? t("all") : status,
            }))}
          />
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-bold">{t("busy_room_schedule")}</h3>
        </div>
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : busySlots.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-3 py-4 text-sm text-muted-foreground">
            {t("no_busy_rooms_for_time")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">{t("room")}</th>
                  <th className="py-3 pr-4">{t("time")}</th>
                  <th className="py-3 pr-4">{t("class")}</th>
                  <th className="py-3 pr-4">{t("subject")}</th>
                  <th className="py-3 pr-4">{t("teacher")}</th>
                </tr>
              </thead>
              <tbody>
                {busySlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">{slot.roomName}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </td>
                    <td className="py-3 pr-4">{slot.className || "-"}</td>
                    <td className="py-3 pr-4">{slot.subjectName || "-"}</td>
                    <td className="py-3 pr-4">{slot.teacherName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold">{t("classroom_list")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("showing")} {toKhmerDigits(filteredRooms.length)} {t("of")}{" "}
            {toKhmerDigits(CLASSROOMS.length)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">{t("no")}</th>
                <th className="py-3 pr-4">{t("building")}</th>
                <th className="py-3 pr-4">{t("room")}</th>
                <th className="py-3 pr-4">{t("availability")}</th>
                <th className="py-3 pr-4">{t("room_hour")}</th>
                <th className="py-3 pr-4">{t("condition")}</th>
                <th className="py-3 pr-4">{t("other")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => {
                const roomBusySlots = busySlots.filter(
                  (slot) => normalizeRoom(slot.roomName) === normalizeRoom(room.room),
                );
                const isBusy = roomBusySlots.length > 0;
                return (
                  <tr
                    key={`${room.building}-${room.room}`}
                    className="border-b border-border/60 hover:bg-muted/40"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {toKhmerDigits(room.no)}
                    </td>
                    <td className="py-3 pr-4 font-semibold">{room.building}</td>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">{room.room}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[10px] font-semibold " +
                          (isBusy ? "bg-warning/10 text-warning" : "bg-success/10 text-success")
                        }
                      >
                        {isBusy ? t("busy") : t("free")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {isBusy
                        ? roomBusySlots
                            .map(
                              (slot) =>
                                `${formatTime(slot.start_time)}-${formatTime(slot.end_time)}`,
                            )
                            .join(", ")
                        : selectedTimeRangeLabel}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[10px] font-semibold " +
                          (room.status === "ល្អ"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning")
                        }
                      >
                        {room.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{room.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{toKhmerDigits(value)}</p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

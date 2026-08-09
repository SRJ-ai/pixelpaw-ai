/**
 * Persistent AI memory (§28). Deliberately explicit and inspectable: nothing is
 * stored unless the user (or an explicit "remember this" action) adds it, and
 * every entry is viewable, editable, deletable, and exportable from Settings.
 */

export type MemoryCategory =
  | "user_profile"
  | "preferences"
  | "goals"
  | "projects"
  | "events"
  | "facts";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  text: string;
  createdAt: string; // ISO
}

export const MEMORY_LABELS: Record<MemoryCategory, string> = {
  user_profile: "About you",
  preferences: "Preferences",
  goals: "Goals",
  projects: "Projects",
  events: "Important events",
  facts: "Facts",
};

const KEY = "pixelpaw.memory.v1";

export function loadMemories(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as MemoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(list: MemoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addMemory(category: MemoryCategory, text: string): MemoryEntry[] {
  const list = loadMemories();
  list.push({
    id: Math.random().toString(36).slice(2, 10),
    category,
    text,
    createdAt: new Date().toISOString(),
  });
  saveMemories(list);
  return list;
}

export function deleteMemory(id: string): MemoryEntry[] {
  const list = loadMemories().filter((m) => m.id !== id);
  saveMemories(list);
  return list;
}

export function clearMemories(): void {
  localStorage.removeItem(KEY);
}

/** Render memories as a compact block for the system prompt. */
export function memoryBlock(): string {
  const list = loadMemories();
  if (list.length === 0) return "";
  const byCat = new Map<MemoryCategory, string[]>();
  for (const m of list) {
    const arr = byCat.get(m.category) ?? [];
    arr.push(m.text);
    byCat.set(m.category, arr);
  }
  const lines: string[] = ["What you remember about this user:"];
  for (const [cat, items] of byCat) {
    lines.push(`${MEMORY_LABELS[cat]}: ${items.join("; ")}`);
  }
  return lines.join("\n");
}

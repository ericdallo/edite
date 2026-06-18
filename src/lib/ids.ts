/** Short, collision-unlikely id for in-memory entities (media, tracks, clips). */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

import { computed, onBeforeUnmount, ref } from "vue";
import type { Point } from "./core/maze";
import type { SearchResult } from "./core/search";

export function usePlayback() {
  const source = ref<SearchResult | null>(null);
  const cursor = ref(0);
  const playing = ref(false);
  const speed = ref<0.5 | 1 | 2>(1);
  let frame = 0;
  let previous = 0;

  const total = computed(() => (source.value?.visitedOrder.length ?? 0) + (source.value?.path.length ?? 0));
  const visibleVisited = computed<Point[]>(() => source.value?.visitedOrder.slice(0, Math.min(cursor.value, source.value.visitedOrder.length)) ?? []);
  const visiblePath = computed<Point[]>(() => {
    if (!source.value) return [];
    return source.value.path.slice(0, Math.max(0, cursor.value - source.value.visitedOrder.length));
  });

  function tick(now: number) {
    if (!playing.value) return;
    if (!previous) previous = now;
    if (now - previous >= 70 / speed.value) {
      cursor.value += 1;
      previous = now;
      if (cursor.value >= total.value) playing.value = false;
    }
    if (playing.value) frame = requestAnimationFrame(tick);
  }

  function play(result?: SearchResult) {
    if (result) {
      source.value = result;
      cursor.value = 0;
    }
    if (!source.value || cursor.value >= total.value) cursor.value = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cursor.value = total.value;
      playing.value = false;
      return;
    }
    playing.value = true;
    previous = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    playing.value = false;
    cancelAnimationFrame(frame);
  }

  function cancel() {
    pause();
    source.value = null;
    cursor.value = 0;
  }

  onBeforeUnmount(cancel);
  return { playing, speed, cursor, total, visibleVisited, visiblePath, play, pause, cancel };
}

import { computed, onBeforeUnmount, ref } from "vue";

export function useTeachingPlayback<T>() {
  const source = ref<T[]>([]);
  const cursor = ref(0);
  const playing = ref(false);
  const speed = ref(1);
  let frame = 0;
  let previous: number | null = null;

  const total = computed(() => source.value.length);
  const visible = computed(() => source.value.slice(0, cursor.value));

  function pause() {
    playing.value = false;
    previous = null;
    cancelAnimationFrame(frame);
  }

  function tick(now: number) {
    if (!playing.value) return;
    if (previous === null) previous = now;
    const interval = 70 / speed.value;
    const steps = Math.floor((now - previous) / interval);
    if (steps > 0) {
      cursor.value = Math.min(total.value, cursor.value + steps);
      previous += steps * interval;
      if (cursor.value >= total.value) {
        playing.value = false;
        previous = null;
      }
    }
    if (playing.value) frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!source.value.length) return;
    if (cursor.value >= total.value) cursor.value = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cursor.value = total.value;
      playing.value = false;
      return;
    }
    pause();
    playing.value = true;
    frame = requestAnimationFrame(tick);
  }

  function load(events: readonly T[]) {
    pause();
    source.value = [...events];
    cursor.value = 0;
  }

  function stepForward() {
    pause();
    cursor.value = Math.min(total.value, cursor.value + 1);
  }

  function stepBack() {
    pause();
    cursor.value = Math.max(0, cursor.value - 1);
  }

  function reset() {
    pause();
    cursor.value = 0;
  }

  function clear() {
    pause();
    source.value = [];
    cursor.value = 0;
  }

  onBeforeUnmount(clear);
  return { source, cursor, playing, speed, total, visible, load, play, pause, stepForward, stepBack, reset, clear };
}

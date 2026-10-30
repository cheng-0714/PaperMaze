import { afterEach, expect, it, vi } from "vitest";
import type * as Vue from "vue";
import { useTeachingPlayback } from "./useTeachingPlayback";
import type { SearchTeachingEvent } from "./core/search";

vi.mock("vue", async (original) => ({ ...await original<typeof Vue>(), onBeforeUnmount: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it("moves forward and backward through a loaded teaching trace", () => {
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const events: SearchTeachingEvent[] = [
    { type: "start", point: { row: 1, col: 1 } },
    { type: "dequeue", point: { row: 1, col: 1 } },
    { type: "finish", found: false },
  ];
  const playback = useTeachingPlayback<SearchTeachingEvent>();

  playback.load(events);
  expect(playback.total.value).toBe(3);
  expect(playback.cursor.value).toBe(0);
  playback.stepForward();
  playback.stepForward();
  expect(playback.cursor.value).toBe(2);
  playback.stepBack();
  expect(playback.cursor.value).toBe(1);
  playback.reset();
  expect(playback.cursor.value).toBe(0);
});

it("plays a teaching trace by elapsed time and pauses without advancing", () => {
  let callback: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const playback = useTeachingPlayback<SearchTeachingEvent>();
  playback.load([
    { type: "start", point: { row: 1, col: 1 } },
    { type: "dequeue", point: { row: 1, col: 1 } },
    { type: "finish", found: false },
  ]);

  playback.speed.value = 2;
  playback.play();
  callback(0);
  callback(70);
  expect(playback.cursor.value).toBe(2);
  playback.pause();
  callback(700);
  expect(playback.cursor.value).toBe(2);
});

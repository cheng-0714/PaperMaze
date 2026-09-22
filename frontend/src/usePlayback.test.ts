import { afterEach, expect, it, vi } from "vitest";
import { usePlayback } from "./usePlayback";
import { generateMaze } from "./core/maze";
import { searchMaze } from "./core/search";

vi.mock("vue", async (original) => ({ ...await original<typeof import("vue")>(), onBeforeUnmount: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it("advances by elapsed time at 5x, resumes without counting paused time, and finishes exactly", () => {
  let callback: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const playback = usePlayback();
  playback.speed.value = 5;
  playback.play(searchMaze(generateMaze(51, 12345), "bfs"));
  callback(0);
  callback(70);
  expect(playback.cursor.value).toBe(5);
  playback.pause();
  callback(700);
  expect(playback.cursor.value).toBe(5);
  playback.speed.value = .5;
  playback.play();
  callback(1000);
  callback(1140);
  expect(playback.cursor.value).toBe(6);
  callback(1_000_000);
  expect(playback.cursor.value).toBe(playback.total.value);
  expect(playback.playing.value).toBe(false);
});

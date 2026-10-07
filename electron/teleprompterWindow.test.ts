import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: { getPath: () => "/tmp", isReady: () => true },
	BrowserWindow: { getAllWindows: () => [] },
	ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

import {
	resolveTeleprompterBounds,
	supportsTeleprompterCaptureExclusion,
} from "./teleprompterWindow";

const primary = { x: 0, y: 0, width: 1920, height: 1040 };

describe("teleprompter window", () => {
	it("opens top-centre, near the webcam, by default", () => {
		const bounds = resolveTeleprompterBounds(null, [primary], primary);
		expect(bounds.y).toBe(16);
		expect(bounds.x + bounds.width / 2).toBeCloseTo(960, 0);
	});

	it("restores a saved position that is still on screen", () => {
		const saved = { x: 100, y: 200, width: 600, height: 280 };
		expect(resolveTeleprompterBounds(saved, [primary], primary)).toEqual(saved);
	});

	it("ignores a saved position on a disconnected monitor", () => {
		const saved = { x: 3000, y: 200, width: 600, height: 280 };
		expect(resolveTeleprompterBounds(saved, [primary], primary).x).toBeLessThan(1920);
	});

	it("fits small screens", () => {
		const small = { x: 0, y: 0, width: 640, height: 480 };
		expect(resolveTeleprompterBounds(null, [small], small).width).toBeLessThanOrEqual(608);
	});

	it("hides from capture on Windows and macOS only", () => {
		expect(supportsTeleprompterCaptureExclusion("win32")).toBe(true);
		expect(supportsTeleprompterCaptureExclusion("darwin")).toBe(true);
		expect(supportsTeleprompterCaptureExclusion("linux")).toBe(false);
	});
});

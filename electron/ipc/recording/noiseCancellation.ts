import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
	getNoiseCancellationFilters,
	NOISE_CANCELLATION_SETTING_KEY,
	type NoiseCancellationLevel,
	normalizeNoiseCancellationLevel,
} from "../../../src/lib/noiseCancellation";
import { readAppSetting } from "../../appSettingsStore";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";

const execFileAsync = promisify(execFile);
const ANC_TIMEOUT_MS = 5 * 60 * 1000;

export function getActiveNoiseCancellationLevel(): NoiseCancellationLevel {
	try {
		return normalizeNoiseCancellationLevel(readAppSetting(NOISE_CANCELLATION_SETTING_KEY));
	} catch {
		return "off";
	}
}

/** Output codec args that keep the sidecar in the same format the editor expects. */
export function getNoiseCancellationCodecArgs(filePath: string): string[] {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".m4a" || ext === ".aac" || ext === ".mp4") {
		return ["-c:a", "aac", "-b:a", "160k"];
	}
	if (ext === ".webm" || ext === ".ogg" || ext === ".opus") {
		return ["-c:a", "libopus", "-b:a", "128k"];
	}
	return ["-c:a", "pcm_s16le"];
}

export function buildNoiseCancellationArgs(
	inputPath: string,
	outputPath: string,
	level: NoiseCancellationLevel,
): string[] {
	return [
		"-y",
		"-hide_banner",
		"-nostdin",
		"-nostats",
		"-i",
		inputPath,
		"-vn",
		"-af",
		getNoiseCancellationFilters(level).join(","),
		...getNoiseCancellationCodecArgs(inputPath),
		outputPath,
	];
}

/**
 * Cleans the microphone sidecar in place when ANC is on. The duration and
 * timing are unchanged, so the editor's audio sync is unaffected. If anything
 * fails the original file is left untouched.
 *
 * Returns the level that was applied ("off" when nothing was done).
 */
export async function applyNoiseCancellationToMicFile(
	micPath: string | null | undefined,
	level: NoiseCancellationLevel = getActiveNoiseCancellationLevel(),
): Promise<NoiseCancellationLevel> {
	if (!micPath || level === "off") {
		return "off";
	}

	const ext = path.extname(micPath);
	const tempPath = `${micPath.slice(0, micPath.length - ext.length)}.anc-tmp${ext}`;
	const started = Date.now();

	try {
		const stat = await fs.stat(micPath);
		if (stat.size === 0) {
			return "off";
		}

		await execFileAsync(
			getFfmpegBinaryPath(),
			buildNoiseCancellationArgs(micPath, tempPath, level),
			{
				timeout: ANC_TIMEOUT_MS,
				maxBuffer: 10 * 1024 * 1024,
			},
		);

		const cleaned = await fs.stat(tempPath);
		if (cleaned.size === 0) {
			throw new Error("noise cancellation produced an empty file");
		}

		await fs.rename(tempPath, micPath).catch(async () => {
			await fs.copyFile(tempPath, micPath);
			await fs.rm(tempPath, { force: true });
		});
		console.log(
			`[anc] Applied ${level} noise cancellation to ${path.basename(micPath)} in ${Date.now() - started}ms`,
		);
		return level;
	} catch (error) {
		console.warn(
			"[anc] Noise cancellation failed; keeping the original microphone audio.",
			error,
		);
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		return "off";
	}
}

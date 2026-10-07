import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontalIcon, MinusIcon, PauseIcon, PlayIcon, XIcon } from "@/components/ui/icons";
import { isLiteModeActive } from "@/lib/liteMode";
import styles from "./Teleprompter.module.css";
import {
	countWords,
	CUE_POSITION,
	FONT_MAX,
	FONT_MIN,
	FONT_STEP,
	formatDuration,
	getPixelsPerSecond,
	getRemainingSeconds,
	loadPrefs,
	loadScript,
	savePrefs,
	saveScript,
	splitParagraphs,
	type TeleprompterPrefs,
	WPM_MAX,
	WPM_MIN,
	WPM_STEP,
} from "./teleprompterModel";

const CONTROLS_IDLE_MS = 2200;
const SAVE_DELAY_MS = 400;

type Mode = "edit" | "read";

export function TeleprompterWindow() {
	const [script, setScript] = useState(loadScript);
	const [prefs, setPrefs] = useState<TeleprompterPrefs>(loadPrefs);
	const [mode, setMode] = useState<Mode>(() => (loadScript().trim() ? "read" : "edit"));
	const [playing, setPlaying] = useState(false);
	const [recording, setRecording] = useState(false);
	const [progress, setProgress] = useState(0);
	const [controlsVisible, setControlsVisible] = useState(true);
	const [captureHidden, setCaptureHidden] = useState(true);

	const stageRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const offsetRef = useRef(0);
	const maxOffsetRef = useRef(0);
	const contentHeightRef = useRef(0);
	const cueTopRef = useRef(0);
	const playingRef = useRef(false);
	const prefsRef = useRef(prefs);
	const idleTimerRef = useRef<number | null>(null);

	const paragraphs = useMemo(() => splitParagraphs(script), [script]);
	const wordCount = useMemo(() => countWords(script), [script]);
	const wordCountRef = useRef(wordCount);
	const lite = useMemo(() => isLiteModeActive(), []);

	prefsRef.current = prefs;
	wordCountRef.current = wordCount;

	// ---- persistence -------------------------------------------------------
	useEffect(() => {
		const timer = window.setTimeout(() => saveScript(script), SAVE_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [script]);

	useEffect(() => {
		savePrefs(prefs);
	}, [prefs]);

	// ---- scrolling ---------------------------------------------------------
	const applyOffset = useCallback((next: number) => {
		const clamped = Math.min(maxOffsetRef.current, Math.max(0, next));
		offsetRef.current = clamped;
		if (trackRef.current) {
			trackRef.current.style.transform = `translate3d(0, ${-clamped}px, 0)`;
		}
		const total = maxOffsetRef.current;
		setProgress(total > 0 ? clamped / total : 0);
		return clamped;
	}, []);

	const measure = useCallback(() => {
		const stage = stageRef.current;
		const track = trackRef.current;
		if (!stage || !track) return;
		const cueTop = Math.round(stage.clientHeight * CUE_POSITION);
		cueTopRef.current = cueTop;
		track.style.paddingTop = `${cueTop}px`;
		track.style.paddingBottom = `${stage.clientHeight - cueTop}px`;
		const contentHeight = Math.max(0, track.scrollHeight - stage.clientHeight);
		contentHeightRef.current = contentHeight;
		maxOffsetRef.current = contentHeight;
		applyOffset(offsetRef.current);
	}, [applyOffset]);

	useEffect(() => {
		if (mode !== "read") return;
		measure();
		const observer = new ResizeObserver(() => measure());
		if (stageRef.current) observer.observe(stageRef.current);
		if (trackRef.current) observer.observe(trackRef.current);
		return () => observer.disconnect();
	}, [mode, measure, prefs.fontSize, paragraphs]);

	useEffect(() => {
		playingRef.current = playing;
		if (!playing) return;

		let frame = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			const speed = getPixelsPerSecond(
				contentHeightRef.current,
				wordCountRef.current,
				prefsRef.current.wpm,
			);
			const reached = applyOffset(offsetRef.current + speed * dt);
			if (reached >= maxOffsetRef.current) {
				setPlaying(false);
				return;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, applyOffset]);

	const restart = useCallback(() => {
		applyOffset(0);
	}, [applyOffset]);

	const togglePlay = useCallback(() => {
		if (
			!playingRef.current &&
			offsetRef.current >= maxOffsetRef.current &&
			maxOffsetRef.current > 0
		) {
			applyOffset(0);
		}
		setPlaying((current) => !current);
	}, [applyOffset]);

	// ---- recording link ----------------------------------------------------
	useEffect(() => {
		const api = window.electronAPI;
		if (!api?.onTeleprompterRecordingState) return;
		void api.getTeleprompterRecordingState?.().then((active) => setRecording(Boolean(active)));
		void api
			.getTeleprompterPlatformInfo?.()
			.then((info) => setCaptureHidden(info?.captureExclusionSupported !== false));
		return api.onTeleprompterRecordingState((active) => {
			setRecording(active);
			if (!prefsRef.current.startWithRecording) return;
			if (active) {
				setMode("read");
				setPlaying(true);
			} else {
				setPlaying(false);
			}
		});
	}, []);

	// ---- controls auto-hide while playing ----------------------------------
	const wakeControls = useCallback(() => {
		setControlsVisible(true);
		if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
		idleTimerRef.current = window.setTimeout(() => {
			if (playingRef.current) setControlsVisible(false);
		}, CONTROLS_IDLE_MS);
	}, []);

	useEffect(() => {
		if (playing) wakeControls();
		else setControlsVisible(true);
	}, [playing, wakeControls]);

	// ---- preferences -------------------------------------------------------
	const updatePrefs = useCallback((patch: Partial<TeleprompterPrefs>) => {
		setPrefs((current) => ({ ...current, ...patch }));
	}, []);

	const changeSpeed = useCallback(
		(delta: number) =>
			setPrefs((current) => ({
				...current,
				wpm: Math.min(WPM_MAX, Math.max(WPM_MIN, current.wpm + delta)),
			})),
		[],
	);

	const changeFont = useCallback(
		(delta: number) => {
			// Keep the same sentence on the cue line when the text reflows.
			const ratio = maxOffsetRef.current > 0 ? offsetRef.current / maxOffsetRef.current : 0;
			setPrefs((current) => ({
				...current,
				fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, current.fontSize + delta)),
			}));
			requestAnimationFrame(() => {
				measure();
				applyOffset(ratio * maxOffsetRef.current);
			});
		},
		[applyOffset, measure],
	);

	// ---- keyboard ----------------------------------------------------------
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (mode === "edit") {
				if (event.key === "Escape" && script.trim()) {
					event.preventDefault();
					setMode("read");
				}
				return;
			}
			wakeControls();
			switch (event.key) {
				case " ":
					event.preventDefault();
					togglePlay();
					break;
				case "ArrowUp":
					event.preventDefault();
					changeSpeed(WPM_STEP);
					break;
				case "ArrowDown":
					event.preventDefault();
					changeSpeed(-WPM_STEP);
					break;
				case "+":
				case "=":
					changeFont(FONT_STEP);
					break;
				case "-":
					changeFont(-FONT_STEP);
					break;
				case "Home":
				case "r":
				case "R":
					restart();
					break;
				case "m":
				case "M":
					updatePrefs({ mirror: !prefsRef.current.mirror });
					break;
				case "e":
				case "E":
					setPlaying(false);
					setMode("edit");
					break;
				case "Escape":
					setPlaying(false);
					break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mode, script, togglePlay, changeSpeed, changeFont, restart, updatePrefs, wakeControls]);

	const jumpToParagraph = (element: HTMLElement) => {
		const track = trackRef.current;
		if (!track) return;
		applyOffset(element.offsetTop - cueTopRef.current);
	};

	const remaining = formatDuration(getRemainingSeconds(progress, wordCount, prefs.wpm));
	const total = formatDuration(getRemainingSeconds(0, wordCount, prefs.wpm));

	return (
		<div
			className={styles.root}
			data-lite={lite || undefined}
			onMouseMove={wakeControls}
			style={{ ["--tp-font-size" as string]: `${prefs.fontSize}px` }}
		>
			<header className={styles.titleBar}>
				<div className={styles.status}>
					<span className={styles.tally} data-live={recording || undefined} aria-hidden />
					<span>{recording ? "Recording" : "Teleprompter"}</span>
				</div>
				<div className={styles.timeLeft} aria-live="off">
					{mode === "read" && wordCount > 0 ? `${remaining} left` : null}
				</div>
				<div className={styles.windowButtons}>
					<button
						type="button"
						className={styles.iconButton}
						onClick={() => window.electronAPI?.minimizeTeleprompter?.()}
						aria-label="Minimize teleprompter"
						title="Minimize"
					>
						<MinusIcon size={16} />
					</button>
					<button
						type="button"
						className={styles.iconButton}
						onClick={() => window.electronAPI?.closeTeleprompter?.()}
						aria-label="Close teleprompter"
						title="Close"
					>
						<XIcon size={16} />
					</button>
				</div>
			</header>

			{mode === "edit" ? (
				<section className={styles.editor}>
					<textarea
						className={styles.scriptInput}
						value={script}
						onChange={(event) => setScript(event.target.value)}
						placeholder={
							"Paste or type your script here.\n\nLeave a blank line to start a new paragraph. Bangla and English both work."
						}
						spellCheck
						autoFocus
						aria-label="Script"
					/>
					<footer className={styles.editorFooter}>
						<span className={styles.meta}>
							{wordCount === 0
								? "No script yet"
								: `${wordCount} words, about ${total} at ${prefs.wpm} words per minute`}
						</span>
						<button
							type="button"
							className={styles.primaryButton}
							disabled={wordCount === 0}
							onClick={() => {
								offsetRef.current = 0;
								setMode("read");
							}}
						>
							Start reading
						</button>
					</footer>
				</section>
			) : (
				<>
					<div
						ref={stageRef}
						className={styles.stage}
						onWheel={(event) => applyOffset(offsetRef.current + event.deltaY)}
					>
						<div className={styles.mirrorBox} data-mirror={prefs.mirror || undefined}>
							<div ref={trackRef} className={styles.track}>
								{paragraphs.map((paragraph, index) => (
									<p
										key={index}
										className={styles.paragraph}
										onDoubleClick={(event) =>
											jumpToParagraph(event.currentTarget)
										}
									>
										{paragraph}
									</p>
								))}
							</div>
						</div>
						<div
							className={styles.readShade}
							// Stop the shade just above the cue so the line being read stays bright.
							style={{
								height: `calc(${CUE_POSITION * 100}% - ${Math.round(prefs.fontSize * 0.55)}px)`,
							}}
							aria-hidden
						/>
						<div
							className={styles.cue}
							style={{ top: `${CUE_POSITION * 100}%` }}
							aria-hidden
						/>
						<div className={styles.progressRail} aria-hidden>
							<div
								className={styles.progressFill}
								style={{ transform: `scaleY(${progress})` }}
							/>
						</div>
						{!captureHidden && (
							<p className={styles.captureWarning}>
								On Linux this window shows up in recordings. Keep it on a screen you
								are not recording.
							</p>
						)}
					</div>

					<footer className={styles.controls} data-hidden={!controlsVisible || undefined}>
						<button
							type="button"
							className={styles.playButton}
							onClick={togglePlay}
							aria-label={playing ? "Pause" : "Play"}
							title={playing ? "Pause (Space)" : "Play (Space)"}
						>
							{playing ? (
								<PauseIcon size={20} weight="fill" />
							) : (
								<PlayIcon size={20} weight="fill" />
							)}
						</button>
						<button
							type="button"
							className={`${styles.textButton} ${styles.optional}`}
							onClick={restart}
							title="Back to the start (R)"
						>
							Restart
						</button>

						<div className={styles.stepper} role="group" aria-label="Reading speed">
							<button
								type="button"
								className={styles.stepButton}
								onClick={() => changeSpeed(-WPM_STEP)}
								aria-label="Slower"
								title="Slower (↓)"
							>
								−
							</button>
							<span className={styles.stepValue}>
								{prefs.wpm}
								<small> wpm</small>
							</span>
							<button
								type="button"
								className={styles.stepButton}
								onClick={() => changeSpeed(WPM_STEP)}
								aria-label="Faster"
								title="Faster (↑)"
							>
								+
							</button>
						</div>

						<div className={styles.stepper} role="group" aria-label="Text size">
							<button
								type="button"
								className={styles.stepButton}
								onClick={() => changeFont(-FONT_STEP)}
								aria-label="Smaller text"
								title="Smaller text (−)"
							>
								<span className={styles.smallA}>A</span>
							</button>
							<button
								type="button"
								className={styles.stepButton}
								onClick={() => changeFont(FONT_STEP)}
								aria-label="Larger text"
								title="Larger text (+)"
							>
								<span className={styles.bigA}>A</span>
							</button>
						</div>

						<button
							type="button"
							className={styles.iconToggle}
							aria-pressed={prefs.mirror}
							onClick={() => updatePrefs({ mirror: !prefs.mirror })}
							title="Mirror text for a beam-splitter rig (M)"
							aria-label="Mirror text"
						>
							<FlipHorizontalIcon size={18} />
						</button>

						<label
							className={styles.autoStart}
							title="Scroll starts when recording starts and pauses when it stops"
						>
							<input
								type="checkbox"
								checked={prefs.startWithRecording}
								onChange={(event) =>
									updatePrefs({ startWithRecording: event.target.checked })
								}
							/>
							<span>Start with recording</span>
						</label>

						<button
							type="button"
							className={styles.textButton}
							onClick={() => {
								setPlaying(false);
								setMode("edit");
							}}
							title="Edit script (E)"
						>
							<span className={styles.optional}>Edit script</span>
							<span className={styles.compactOnly}>Edit</span>
						</button>
					</footer>
				</>
			)}
		</div>
	);
}

export default TeleprompterWindow;

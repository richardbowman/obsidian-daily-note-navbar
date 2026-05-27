import { ButtonComponent, MarkdownView, Notice, Menu, moment, Keymap } from "obsidian";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";
import { getDatesAroundDate, getDateFromFileName } from "../utils";
import { FileOpenType } from "../types";
import { FILE_OPEN_TYPES_MAPPING, FILE_OPEN_TYPES_TO_PANE_TYPE } from "./consts";
import { getDailyNoteFile } from "../utils";
import DailyNoteNavbarPlugin from "../main";

// Accumulated horizontal scroll distance needed to move one day.
const WHEEL_STEP = 80;
// Minimum horizontal swipe distance (px) to trigger day navigation.
const SWIPE_THRESHOLD = 50;

export default class DailyNoteNavbar {
	id: string;
	date: moment.Moment;
	/** Day offset from the active note date. Arrows shift by ±7; swipe/scroll shift by ±1. */
	dayOffset = 0;
	plugin: DailyNoteNavbarPlugin;
	containerEl: HTMLElement;
	parentEl: HTMLElement;
	view: MarkdownView;

	private wheelAccumulator = 0;
	private touchStartX = 0;

	constructor(plugin: DailyNoteNavbarPlugin, id: string, view: MarkdownView, parentEl: HTMLElement, date: moment.Moment) {
		this.id = id;
		this.date = date;
		this.dayOffset = 0;
		this.plugin = plugin;
		this.view = view;

		this.containerEl = createDiv();
		this.containerEl.addClass("daily-note-navbar");
		this.containerEl.setAttribute("daily-note-navbar-id", this.id);
		this.parentEl = parentEl;
		this.parentEl.appendChild(this.containerEl);

		// Wheel: horizontal trackpad scroll navigates by day.
		// passive: false so we can preventDefault and stop Obsidian scrolling the note.
		this.containerEl.addEventListener("wheel", this.onWheel, { passive: false });

		// Touch: swipe left/right navigates by day.
		this.containerEl.addEventListener("touchstart", this.onTouchStart, { passive: true });
		this.containerEl.addEventListener("touchend", this.onTouchEnd, { passive: true });

		// Remove navbar when view unloads
		this.view.onunload = () => this.plugin.removeNavbar(this.id);

		this.rerender();
	}

	// Arrow functions so `this` is bound without .bind() — safe to pass directly to addEventListener.
	private onWheel = (event: WheelEvent) => {
		// Ignore events that are predominantly vertical (e.g. normal page scroll).
		if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;

		event.preventDefault();
		this.wheelAccumulator += event.deltaX;

		const steps = Math.trunc(this.wheelAccumulator / WHEEL_STEP);
		if (steps !== 0) {
			this.dayOffset += steps;
			this.wheelAccumulator -= steps * WHEEL_STEP;
			this.rerender();
		}
	};

	private onTouchStart = (event: TouchEvent) => {
		this.touchStartX = event.touches[0].clientX;
	};

	private onTouchEnd = (event: TouchEvent) => {
		const deltaX = event.changedTouches[0].clientX - this.touchStartX;
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			// Swipe left = positive deltaX from start -> advance (later dates)
			this.dayOffset += deltaX < 0 ? 1 : -1;
			this.rerender();
		}
	};

	rerender() {
		// Update date from view if the active file has changed; reset offset so the
		// new note is re-centered.
		const activeFile = this.view.file;
		const fileDate = activeFile ? getDateFromFileName(activeFile.basename, this.plugin.settings.dailyNoteDateFormat) : null;
		if (fileDate && fileDate.format("YYYY-MM-DD") !== this.date.format("YYYY-MM-DD")) {
			this.date = fileDate;
			this.dayOffset = 0;
		}
		this.containerEl.replaceChildren();

		const currentDate = moment();
		const centerDate = this.date.clone().add(this.dayOffset, "days");
		const dates = getDatesAroundDate(centerDate);

		// Previous week button (shifts center back 7 days)
		new ButtonComponent(this.containerEl)
			.setClass("daily-note-navbar__change-week")
			.setIcon("left-arrow")
			.setTooltip("Previous week")
			.onClick(() => {
				this.dayOffset -= 7;
				this.rerender();
			});

		// Daily note buttons
		for (const date of dates) {
			const dateString = date.format("YYYY-MM-DD");
			const isActive = this.date.format("YYYY-MM-DD") === dateString;
			const isCurrent = currentDate.format("YYYY-MM-DD") === dateString;
			const exists = getDailyNote(date, getAllDailyNotes());
			const stateClass = isActive ? "daily-note-navbar__active" : exists ? "daily-note-navbar__default" : "daily-note-navbar__not-exists";

			const button = new ButtonComponent(this.containerEl)
				.setClass("daily-note-navbar__date")
				.setClass(stateClass)
				.setButtonText(`${date.format(this.plugin.settings.dateFormat)} ${date.date()}`)
				.setTooltip(`${date.format(this.plugin.settings.tooltipDateFormat)}`);
			if (isCurrent) {
				button.setClass("daily-note-navbar__current");
			}

			// Click / modifier-click / right-click
			button.buttonEl.onClickEvent((event: MouseEvent) => {
				const paneType = Keymap.isModEvent(event);
				if (paneType && paneType !== true) {
					const openType = FILE_OPEN_TYPES_TO_PANE_TYPE[paneType];
					this.plugin.openDailyNote(date, openType);
				} else if (event.type === "click") {
					const openType = event.ctrlKey ? "New tab" : this.plugin.settings.defaultOpenType;
					// Already open in active pane — no-op
					const isActive = this.date.format("YYYY-MM-DD") === date.format("YYYY-MM-DD");
					if (isActive && openType === "Active") return;
					this.plugin.openDailyNote(date, openType);
				} else if (event.type === "auxclick") {
					this.createContextMenu(event, date);
				}
			});
		}

		// Next week button (shifts center forward 7 days)
		new ButtonComponent(this.containerEl)
			.setClass("daily-note-navbar__change-week")
			.setIcon("right-arrow")
			.setTooltip("Next week")
			.onClick(() => {
				this.dayOffset += 7;
				this.rerender();
			});
	}

	createContextMenu(event: MouseEvent, date: moment.Moment) {
		const menu = new Menu();

		for (const [openType, itemValues] of Object.entries(FILE_OPEN_TYPES_MAPPING)) {
			menu.addItem(item => item
				.setIcon(itemValues.icon)
				.setTitle(itemValues.title)
				.onClick(async () => {
					this.plugin.openDailyNote(date, openType as FileOpenType);
				}));
		}

		menu.addSeparator();

		menu.addItem(item => item
			.setIcon("copy")
			.setTitle("Copy Obsidian URL")
			.onClick(async () => {
				const dailyNote = await getDailyNoteFile(date);
				const extensionLength = dailyNote.extension.length > 0 ? dailyNote.extension.length + 1 : 0;
				const fileName = encodeURIComponent(dailyNote.path.slice(0, -extensionLength));
				const vaultName = this.plugin.app.vault.getName();
				const url = `obsidian://open?vault=${vaultName}&file=${fileName}`;
				navigator.clipboard.writeText(url);
				new Notice("URL copied to your clipboard");
			}));

		menu.showAtMouseEvent(event);
	}
}

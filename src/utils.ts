import { View, moment, TFile } from "obsidian";
import DailyNoteNavbar from "./dailyNoteNavbar/dailyNoteNavbar";
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';

/**
 * Returns `radius * 2 + 1` dates centered on the given date.
 * The center date sits at position `radius` in the returned array.
 *
 * @param {moment.Moment} centerDate - The date to center on.
 * @param {number} radius - Number of days on each side (default 3, giving 7 total).
 * @returns {moment.Moment[]} Dates from centerDate - radius to centerDate + radius.
 */
export function getDatesAroundDate(centerDate: moment.Moment, radius = 3): moment.Moment[] {
	const dates = [];
	for (let i = -radius; i <= radius; i++) {
		dates.push(centerDate.clone().add(i, 'days'));
	}
	return dates;
}

/**
 * Gets date based on given basename.
 *
 * @param {string} basename - The basename of the file.
 * @param {string} dateFormat - The date format of the filename.
 * @returns {moment.Moment} Returns the date or null if there is no date.
 */
export function getDateFromFileName(basename: string, dateFormat: string): moment.Moment {
	return moment(basename, dateFormat, true);
}

/**
 * Hides all children in element.
 *
 * @param {HTMLElement} el - The parent element which children to hide.
 */
export function hideChildren(el: HTMLElement) {
	for (let k = 0; k < el.children.length; k++) {
		el.children[k].addClass("daily-note-navbar__hidden");
	}
}

/**
 * Shows all children in element.
 *
 * @param {HTMLElement} el - The parent element which children to show.
 */
export function showChildren(el: HTMLElement) {
	for (let k = 0; k < el.children.length; k++) {
		el.children[k].removeClass("daily-note-navbar__hidden");
	}
}

/**
 * Converts array of strings into record.
 *
 * @param {string[]} arr - The array of strings to convert to record.
 * @return {Record<string, string>} Returns the created record.
 */
export function toRecord(arr: string[]): Record<string, string> {
	const recordObject: Record<string, string> = {};
	arr.forEach(item => recordObject[item] = item)
	return recordObject;
}

/**
 * Gets the daily note file for the given date.
 *
 * @note This creates the daily note if it doesn't aldready exist.
 * @param {moment.Moment} date - The date to get file for.
 * @return {TFile} Returns the daily note file.
 */
export async function getDailyNoteFile(date: moment.Moment): Promise<TFile> {
	return getDailyNote(date, getAllDailyNotes()) ?? await createDailyNote(date);
}

/**
 * Get navbar id from view if it exists.
 *
 * @param {MarkdownView} view - The view to select the navbar from.
 * @return {string | null} The navbar id or null.
 */
export function selectNavbarFromView(view: View): string | null {
	const navbars = view.containerEl.getElementsByClassName("daily-note-navbar");
	if (navbars.length > 0) {
		const navbarEl = navbars[0];
		return navbarEl.getAttribute("daily-note-navbar-id");
	}
	return null;
}

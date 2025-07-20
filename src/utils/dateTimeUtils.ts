import * as vscode from 'vscode';

/**
 * Utility functions for date and time formatting
 */
export class DateTimeUtils {
	/**
	 * Format a date according to user preferences
	 */
	public static formatDateTime(date: Date): string {
		const config = vscode.workspace.getConfiguration('codeLicenses.display');
		const dateFormat = config.get<string>('dateFormat', 'international');

		if (dateFormat === 'us') {
			// US format: "July 17, 2025, 6:22 PM"
			return date.toLocaleString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			});
		} else {
			// International format: "17 July 2025, 18:22"
			return date.toLocaleString('en-GB', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}
	}

	/**
	 * Format just the date part
	 */
	public static formatDate(date: Date): string {
		const config = vscode.workspace.getConfiguration('codeLicenses.display');
		const dateFormat = config.get<string>('dateFormat', 'international');

		if (dateFormat === 'us') {
			// US format: "July 17, 2025"
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
		} else {
			// International format: "17 July 2025"
			return date.toLocaleDateString('en-GB', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
		}
	}

	/**
	 * Format just the time part
	 */
	public static formatTime(date: Date): string {
		const config = vscode.workspace.getConfiguration('codeLicenses.display');
		const dateFormat = config.get<string>('dateFormat', 'international');

		if (dateFormat === 'us') {
			// US format: "6:22 PM"
			return date.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			});
		} else {
			// International format: "18:22"
			return date.toLocaleTimeString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		}
	}
}

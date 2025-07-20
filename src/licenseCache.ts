import * as vscode from 'vscode';
import { ConfigurationManager } from './configurationManager';
import { LicenseInfo, LicenseTextCache } from './types';

export class LicenseCache {
	private static context: vscode.ExtensionContext | null = null;
	private static saveTimeout: NodeJS.Timeout | null = null;
	private static licenseInfoCache: Map<
		string,
		{
			data: LicenseInfo;
			fetchedAt: Date;
			projectType: string;
		}
	> = new Map();

	private static licenseTextCache: LicenseTextCache = {};

	/**
	 * Initialize the cache with extension context for persistence
	 */
	public static init(context: vscode.ExtensionContext): void {
		this.context = context;
		this.loadFromPersistentStorage();
	}

	/**
	 * Get cached license info for a dependency
	 */
	public static getCachedLicenseInfo(
		packageName: string,
		version: string,
		projectType: string
	): LicenseInfo | null {
		const config = ConfigurationManager.getCacheConfig();
		if (!config.enabled) {
			return null;
		}

		const key = `${projectType}:${packageName}:${version}`;
		const cached = this.licenseInfoCache.get(key);

		if (!cached) {
			return null;
		}

		// Check if cache entry is expired
		const now = Date.now();
		const age = now - cached.fetchedAt.getTime();

		if (age > config.maxAge) {
			this.licenseInfoCache.delete(key);
			return null;
		}

		return cached.data;
	}

	/**
	 * Cache license info for a dependency
	 */
	public static cacheLicenseInfo(
		packageName: string,
		version: string,
		projectType: string,
		licenseInfo: LicenseInfo
	): void {
		const config = ConfigurationManager.getCacheConfig();
		if (!config.enabled) {
			return;
		}

		const key = `${projectType}:${packageName}:${version}`;

		// Ensure we don't exceed max cache size
		if (this.licenseInfoCache.size >= config.maxSize) {
			this.evictOldestEntries(Math.floor(config.maxSize * 0.1)); // Remove 10%
		}

		this.licenseInfoCache.set(key, {
			data: licenseInfo,
			fetchedAt: new Date(),
			projectType,
		});

		// Save to persistent storage (debounced)
		this.debouncedSave();
	}

	/**
	 * Get cached license text
	 */
	public static getCachedLicenseText(licenseName: string): string | null {
		const config = ConfigurationManager.getCacheConfig();
		if (!config.enabled) {
			return null;
		}

		const cached = this.licenseTextCache[licenseName];
		if (!cached) {
			return null;
		}

		// Check if cache entry is expired
		const now = Date.now();
		const age = now - cached.fetchedAt.getTime();

		if (age > config.maxAge) {
			delete this.licenseTextCache[licenseName];
			return null;
		}

		return cached.text;
	}

	/**
	 * Cache license text
	 */
	public static cacheLicenseText(
		licenseName: string,
		text: string,
		source?: string
	): void {
		const config = ConfigurationManager.getCacheConfig();
		if (!config.enabled) {
			return;
		}

		// Ensure we don't exceed max cache size for license text
		if (Object.keys(this.licenseTextCache).length >= config.maxSize) {
			this.evictOldestLicenseTextEntries(Math.floor(config.maxSize * 0.1));
		}

		this.licenseTextCache[licenseName] = {
			text,
			fetchedAt: new Date(),
			source,
		};

		// Save to persistent storage (debounced)
		this.debouncedSave();
	}

	/**
	 * Clear all caches
	 */
	public static clearAll(): void {
		this.licenseInfoCache.clear();
		this.licenseTextCache = {};

		// Clear persistent storage as well
		if (this.context) {
			this.context.globalState.update('licenseInfoCache', {});
			this.context.globalState.update('licenseTextCache', {});
		}
	}

	/**
	 * Clear expired entries from both caches
	 */
	public static clearExpired(): void {
		const config = ConfigurationManager.getCacheConfig();
		const now = Date.now();

		// Clear expired license info entries
		for (const [key, value] of this.licenseInfoCache.entries()) {
			if (now - value.fetchedAt.getTime() > config.maxAge) {
				this.licenseInfoCache.delete(key);
			}
		}

		// Clear expired license text entries
		for (const [key, value] of Object.entries(this.licenseTextCache)) {
			if (now - value.fetchedAt.getTime() > config.maxAge) {
				delete this.licenseTextCache[key];
			}
		}
	}

	/**
	 * Get cache statistics
	 */
	public static getStats(): {
		licenseInfoEntries: number;
		licenseTextEntries: number;
		totalMemoryUsage: number;
		oldestEntry?: Date;
		newestEntry?: Date;
	} {
		const licenseInfoEntries = this.licenseInfoCache.size;
		const licenseTextEntries = Object.keys(this.licenseTextCache).length;

		// Rough memory usage estimation
		let memoryUsage = 0;
		for (const entry of this.licenseInfoCache.values()) {
			memoryUsage += JSON.stringify(entry).length * 2; // Rough character to byte conversion
		}
		for (const entry of Object.values(this.licenseTextCache)) {
			memoryUsage += entry.text.length * 2;
		}

		// Find oldest and newest entries
		let oldestDate: Date | undefined;
		let newestDate: Date | undefined;

		for (const entry of this.licenseInfoCache.values()) {
			if (!oldestDate || entry.fetchedAt < oldestDate) {
				oldestDate = entry.fetchedAt;
			}
			if (!newestDate || entry.fetchedAt > newestDate) {
				newestDate = entry.fetchedAt;
			}
		}

		for (const entry of Object.values(this.licenseTextCache)) {
			if (!oldestDate || entry.fetchedAt < oldestDate) {
				oldestDate = entry.fetchedAt;
			}
			if (!newestDate || entry.fetchedAt > newestDate) {
				newestDate = entry.fetchedAt;
			}
		}

		return {
			licenseInfoEntries,
			licenseTextEntries,
			totalMemoryUsage: memoryUsage,
			oldestEntry: oldestDate,
			newestEntry: newestDate,
		};
	}

	/**
	 * Export cache data for debugging/inspection
	 */
	public static exportCacheData(): {
		licenseInfo: Array<{
			key: string;
			data: LicenseInfo;
			fetchedAt: string;
			age: number;
		}>;
		licenseText: Array<{
			licenseName: string;
			textLength: number;
			fetchedAt: string;
			age: number;
			source?: string;
		}>;
	} {
		const now = Date.now();

		const licenseInfo = Array.from(this.licenseInfoCache.entries()).map(
			([key, value]) => ({
				key,
				data: value.data,
				fetchedAt: value.fetchedAt.toISOString(),
				age: now - value.fetchedAt.getTime(),
			})
		);

		const licenseText = Object.entries(this.licenseTextCache).map(
			([licenseName, value]) => ({
				licenseName,
				textLength: value.text.length,
				fetchedAt: value.fetchedAt.toISOString(),
				age: now - value.fetchedAt.getTime(),
				source: value.source,
			})
		);

		return { licenseInfo, licenseText };
	}

	private static evictOldestEntries(count: number): void {
		const entries = Array.from(this.licenseInfoCache.entries()).sort(
			([, a], [, b]) => a.fetchedAt.getTime() - b.fetchedAt.getTime()
		);

		for (let i = 0; i < Math.min(count, entries.length); i++) {
			this.licenseInfoCache.delete(entries[i][0]);
		}
	}

	private static evictOldestLicenseTextEntries(count: number): void {
		const entries = Object.entries(this.licenseTextCache).sort(
			([, a], [, b]) => a.fetchedAt.getTime() - b.fetchedAt.getTime()
		);

		for (let i = 0; i < Math.min(count, entries.length); i++) {
			delete this.licenseTextCache[entries[i][0]];
		}
	}

	/**
	 * Preload common licenses into cache
	 */
	public static async preloadCommonLicenses(): Promise<void> {
		const commonLicenses = [
			'MIT',
			'Apache-2.0',
			'BSD-3-Clause',
			'BSD-2-Clause',
			'GPL-3.0',
			'LGPL-2.1',
			'ISC',
		];

		// This would typically be called during extension activation
		// to populate the cache with common license texts
		// Implementation depends on LicenseTextFetcher
	}

	/**
	 * Load cache data from persistent storage
	 */
	private static loadFromPersistentStorage(): void {
		if (!this.context) {
			return;
		}

		try {
			// Load license info cache
			const storedLicenseInfo = this.context.globalState.get<any>(
				'licenseInfoCache',
				{}
			);
			for (const [key, value] of Object.entries(storedLicenseInfo)) {
				this.licenseInfoCache.set(key, {
					...(value as any),
					fetchedAt: new Date((value as any).fetchedAt),
				});
			}

			// Load license text cache
			const storedLicenseText = this.context.globalState.get<LicenseTextCache>(
				'licenseTextCache',
				{}
			);
			for (const [key, value] of Object.entries(storedLicenseText)) {
				this.licenseTextCache[key] = {
					...value,
					fetchedAt: new Date(value.fetchedAt),
				};
			}

			console.log(
				`Loaded ${this.licenseInfoCache.size} license info entries and ${
					Object.keys(this.licenseTextCache).length
				} license text entries from cache`
			);
		} catch (error) {
			console.warn('Failed to load cache from persistent storage:', error);
		}
	}

	/**
	 * Save cache data to persistent storage (debounced)
	 */
	private static debouncedSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = setTimeout(() => {
			this.saveToPersistentStorage();
		}, 1000); // Save after 1 second of inactivity
	}

	/**
	 * Save cache data to persistent storage
	 */
	private static saveToPersistentStorage(): void {
		if (!this.context) {
			return;
		}

		try {
			// Convert Map to plain object for storage
			const licenseInfoToStore: any = {};
			for (const [key, value] of this.licenseInfoCache.entries()) {
				licenseInfoToStore[key] = {
					...value,
					fetchedAt: value.fetchedAt.toISOString(),
				};
			}

			// Convert license text cache for storage
			const licenseTextToStore: any = {};
			for (const [key, value] of Object.entries(this.licenseTextCache)) {
				licenseTextToStore[key] = {
					...value,
					fetchedAt: value.fetchedAt.toISOString(),
				};
			}

			this.context.globalState.update('licenseInfoCache', licenseInfoToStore);
			this.context.globalState.update('licenseTextCache', licenseTextToStore);
		} catch (error) {
			console.warn('Failed to save cache to persistent storage:', error);
		}
	}
}

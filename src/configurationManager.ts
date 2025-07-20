import * as vscode from 'vscode';

export interface LicensesConfiguration {
	cache: {
		enabled: boolean;
		maxAge: number;
		maxSize: number;
	};
	compatibility: {
		showWarnings: boolean;
		strictMode: boolean;
	};
	fetching: {
		timeout: number;
		retryAttempts: number;
	};
	display: {
		groupByLicense: boolean;
		showDescriptions: boolean;
		highlightProblematic: boolean;
	};
}

export class ConfigurationManager {
	private static readonly CONFIGURATION_KEY = 'codeLicenses';

	/**
	 * Get the current configuration
	 */
	public static getConfiguration(): LicensesConfiguration {
		const config = vscode.workspace.getConfiguration(this.CONFIGURATION_KEY);

		return {
			cache: {
				enabled: config.get('cache.enabled', true),
				maxAge: config.get('cache.maxAge', 24) * 60 * 60 * 1000, // Convert hours to milliseconds
				maxSize: config.get('cache.maxSize', 1000),
			},
			compatibility: {
				showWarnings: config.get('compatibility.showWarnings', true),
				strictMode: config.get('compatibility.strictMode', false),
			},
			fetching: {
				timeout: config.get('fetching.timeout', 5000),
				retryAttempts: config.get('fetching.retryAttempts', 3),
			},
			display: {
				groupByLicense: config.get('display.groupByLicense', true),
				showDescriptions: config.get('display.showDescriptions', true),
				highlightProblematic: config.get('display.highlightProblematic', true),
			},
		};
	}

	/**
	 * Update a configuration value
	 */
	public static async updateConfiguration<T>(
		key: string,
		value: T
	): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIGURATION_KEY);
		await config.update(key, value, vscode.ConfigurationTarget.Global);
	}

	/**
	 * Listen for configuration changes
	 */
	public static onConfigurationChanged(
		callback: (config: LicensesConfiguration) => void
	): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.CONFIGURATION_KEY)) {
				callback(this.getConfiguration());
			}
		});
	}

	/**
	 * Get cache configuration
	 */
	public static getCacheConfig(): {
		enabled: boolean;
		maxAge: number;
		maxSize: number;
	} {
		const config = this.getConfiguration();
		return config.cache;
	}

	/**
	 * Get compatibility analysis settings
	 */
	public static getCompatibilityConfig(): {
		showWarnings: boolean;
		strictMode: boolean;
	} {
		const config = this.getConfiguration();
		return config.compatibility;
	}

	/**
	 * Get fetching settings
	 */
	public static getFetchingConfig(): {
		timeout: number;
		retryAttempts: number;
	} {
		const config = this.getConfiguration();
		return config.fetching;
	}

	/**
	 * Get display settings
	 */
	public static getDisplayConfig(): {
		groupByLicense: boolean;
		showDescriptions: boolean;
		highlightProblematic: boolean;
	} {
		const config = this.getConfiguration();
		return config.display;
	}

	/**
	 * Reset configuration to defaults
	 */
	public static async resetToDefaults(): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.CONFIGURATION_KEY);
		const keys = [
			'cache.enabled',
			'cache.maxAge',
			'cache.maxSize',
			'compatibility.showWarnings',
			'compatibility.strictMode',
			'fetching.timeout',
			'fetching.retryAttempts',
			'display.groupByLicense',
			'display.showDescriptions',
			'display.highlightProblematic',
		];

		for (const key of keys) {
			await config.update(key, undefined, vscode.ConfigurationTarget.Global);
		}
	}
}

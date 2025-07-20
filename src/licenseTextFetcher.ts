import * as https from 'https';
import { LicenseCache } from './licenseCache';

export class LicenseTextFetcher {
	/**
	 * Fetch the full text of a license
	 */
	public static async fetchLicenseText(
		licenseName: string,
		packageName?: string
	): Promise<string> {
		// Check cache first
		const cached = LicenseCache.getCachedLicenseText(licenseName);
		if (cached) {
			return cached;
		}

		try {
			const licenseText = await this.fetchFromMultipleSources(
				licenseName,
				packageName
			);

			// Cache the result
			LicenseCache.cacheLicenseText(
				licenseName,
				licenseText,
				'Multiple sources'
			);

			return licenseText;
		} catch (error) {
			console.error(`Error fetching license text for ${licenseName}:`, error);
			return `License text for "${licenseName}" could not be retrieved.\n\nError: ${error}`;
		}
	}

	private static async fetchFromMultipleSources(
		licenseName: string,
		packageName?: string
	): Promise<string> {
		const sources = [
			() => this.fetchFromSPDX(licenseName),
			() => this.fetchFromGitHub(licenseName),
			() => this.fetchFromChooselicense(licenseName),
		];

		// If we have a package name, try package-specific sources first
		if (packageName) {
			sources.unshift(() =>
				this.fetchFromPackageRepository(licenseName, packageName)
			);
		}

		for (const source of sources) {
			try {
				const text = await source();
				if (text && text.length > 100) {
					// Reasonable minimum length
					return text;
				}
			} catch (error) {
				console.warn(`Source failed:`, error);
				continue;
			}
		}

		return this.getFallbackLicenseText(licenseName);
	}

	private static async fetchFromSPDX(licenseName: string): Promise<string> {
		const normalizedName = this.normalizeLicenseForSPDX(licenseName);
		const url = `https://raw.githubusercontent.com/spdx/license-list-data/main/text/${normalizedName}.txt`;

		return new Promise((resolve, reject) => {
			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					if (response.statusCode === 200) {
						resolve(data);
					} else {
						reject(new Error(`SPDX source returned ${response.statusCode}`));
					}
				});
			});

			request.on('error', reject);
			request.setTimeout(5000, () => {
				request.destroy();
				reject(new Error('SPDX request timeout'));
			});
		});
	}

	private static async fetchFromGitHub(licenseName: string): Promise<string> {
		const licenseMap: { [key: string]: string } = {
			MIT: 'mit',
			'Apache-2.0': 'apache-2.0',
			'GPL-3.0': 'gpl-3.0',
			'GPL-2.0': 'gpl-2.0',
			'BSD-3-Clause': 'bsd-3-clause',
			'BSD-2-Clause': 'bsd-2-clause',
			'LGPL-2.1': 'lgpl-2.1',
			'LGPL-3.0': 'lgpl-3.0',
			'MPL-2.0': 'mpl-2.0',
			ISC: 'isc',
		};

		const githubName = licenseMap[licenseName];
		if (!githubName) {
			throw new Error(`No GitHub mapping for ${licenseName}`);
		}

		const url = `https://api.github.com/licenses/${githubName}`;

		return new Promise((resolve, reject) => {
			const request = https.get(
				url,
				{
					headers: {
						'User-Agent': 'VSCode-Licenses-Extension',
						Accept: 'application/vnd.github.v3+json',
					},
				},
				response => {
					let data = '';

					response.on('data', chunk => {
						data += chunk;
					});

					response.on('end', () => {
						try {
							if (response.statusCode === 200) {
								const licenseData = JSON.parse(data);
								resolve(licenseData.body);
							} else {
								reject(new Error(`GitHub API returned ${response.statusCode}`));
							}
						} catch (error) {
							reject(error);
						}
					});
				}
			);

			request.on('error', reject);
			request.setTimeout(5000, () => {
				request.destroy();
				reject(new Error('GitHub API request timeout'));
			});
		});
	}

	private static async fetchFromChooselicense(
		licenseName: string
	): Promise<string> {
		const licenseMap: { [key: string]: string } = {
			MIT: 'mit',
			'Apache-2.0': 'apache-2.0',
			'GPL-3.0': 'gpl-3.0',
			'GPL-2.0': 'gpl-2.0',
			'BSD-3-Clause': 'bsd-3-clause',
			'BSD-2-Clause': 'bsd-2-clause',
			'LGPL-2.1': 'lgpl-2.1',
			'LGPL-3.0': 'lgpl-3.0',
			'MPL-2.0': 'mpl-2.0',
			ISC: 'isc',
		};

		const chooseName = licenseMap[licenseName];
		if (!chooseName) {
			throw new Error(`No ChooseALicense mapping for ${licenseName}`);
		}

		const url = `https://raw.githubusercontent.com/github/choosealicense.com/gh-pages/_licenses/${chooseName}.txt`;

		return new Promise((resolve, reject) => {
			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					if (response.statusCode === 200) {
						// Remove YAML front matter
						const content = data.replace(/^---[\s\S]*?---/, '').trim();
						resolve(content);
					} else {
						reject(new Error(`ChooseALicense returned ${response.statusCode}`));
					}
				});
			});

			request.on('error', reject);
			request.setTimeout(5000, () => {
				request.destroy();
				reject(new Error('ChooseALicense request timeout'));
			});
		});
	}

	private static async fetchFromPackageRepository(
		licenseName: string,
		packageName: string
	): Promise<string> {
		// This would try to fetch license from package's repository
		// For now, we'll skip this implementation
		throw new Error('Package repository fetching not implemented');
	}

	private static getFallbackLicenseText(licenseName: string): string {
		const fallbacks: { [key: string]: string } = {
			MIT: `MIT License

Copyright (c) [year] [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
			'Apache-2.0': `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction,
and distribution as defined by Sections 1 through 9 of this document.

[Full Apache 2.0 license text would be here...]`,
		};

		return (
			fallbacks[licenseName] ||
			`License "${licenseName}" text could not be retrieved from any source.\n\nPlease visit the license provider or package documentation for the full license text.`
		);
	}

	private static normalizeLicenseForSPDX(licenseName: string): string {
		// SPDX uses specific naming conventions
		const spdxMap: { [key: string]: string } = {
			MIT: 'MIT',
			'Apache-2.0': 'Apache-2.0',
			'GPL-3.0': 'GPL-3.0-only',
			'GPL-2.0': 'GPL-2.0-only',
			'BSD-3-Clause': 'BSD-3-Clause',
			'BSD-2-Clause': 'BSD-2-Clause',
			'LGPL-2.1': 'LGPL-2.1-only',
			'LGPL-3.0': 'LGPL-3.0-only',
			'MPL-2.0': 'MPL-2.0',
			ISC: 'ISC',
		};

		return spdxMap[licenseName] || licenseName;
	}

	/**
	 * Clear the license text cache (delegates to LicenseCache)
	 */
	public static clearCache(): void {
		LicenseCache.clearAll();
	}

	/**
	 * Get cache statistics (delegates to LicenseCache)
	 */
	public static getCacheStats(): { size: number; entries: string[] } {
		const stats = LicenseCache.getStats();
		const cacheData = LicenseCache.exportCacheData();

		return {
			size: stats.licenseTextEntries,
			entries: cacheData.licenseText.map(entry => entry.licenseName),
		};
	}
}

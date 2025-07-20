import * as https from 'https';
import { ConfigurationManager } from '../../configurationManager';
import { LicenseInfo } from '../../types';

export class GoLicenseFetcher {
	/**
	 * Fetch license information for Go modules
	 */
	public static async fetchLicenseInfo(
		dependency: LicenseInfo
	): Promise<LicenseInfo> {
		return new Promise(async resolve => {
			const packageName = dependency.name;
			const config = ConfigurationManager.getFetchingConfig();

			// First try pkg.go.dev API
			try {
				const moduleInfo = await this.fetchFromPkgGoDev(packageName, config);
				if (moduleInfo) {
					// Try to get license text from repository
					const licenseText = await this.fetchLicenseText(
						moduleInfo.repository || packageName
					);
					resolve({
						...dependency,
						license: moduleInfo.license,
						repository: moduleInfo.repository,
						homepage: moduleInfo.homepage,
						description: moduleInfo.description,
						licenseText: licenseText || undefined,
					});
					return;
				}
			} catch (error) {
				console.error(
					`Error fetching Go module info for ${packageName}:`,
					error
				);
			}

			// Fallback
			resolve({
				...dependency,
				license: 'See pkg.go.dev',
				repository: `https://pkg.go.dev/${packageName}`,
				homepage: `https://pkg.go.dev/${packageName}`,
				description: 'Go module - check pkg.go.dev for license details',
			});
		});
	}

	private static async fetchFromPkgGoDev(
		packageName: string,
		config: any
	): Promise<any> {
		return new Promise((resolve, reject) => {
			// Try to fetch from pkg.go.dev page directly for license info
			const pageUrl = `https://pkg.go.dev/${packageName}`;

			const request = https.get(pageUrl, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					try {
						if (response.statusCode === 200) {
							// Look for license information in the HTML - try multiple patterns
							let license = 'See pkg.go.dev';

							// Try different license patterns from pkg.go.dev
							const licensePatterns = [
								/<a href="[^"]*LICENSE[^"]*"[^>]*>([^<]+)<\/a>/i,
								/<span class="License-name">([^<]+)<\/span>/i,
								/LICENSE:\s*([^\s,<]+)/i,
								/License:\s*([^\s,<]+)/i,
								/title="License: ([^"]+)"/i,
								/<div class="UnitMeta-detail">\s*<span[^>]*>([^<]+)<\/span>\s*<\/div>/i,
							];

							for (const pattern of licensePatterns) {
								const match = data.match(pattern);
								if (match) {
									license = match[1].trim();
									break;
								}
							}

							// Extract repository URL from the page - try GitHub, GitLab, etc.
							let repository = `https://pkg.go.dev/${packageName}`;
							const repoPatterns = [
								/<a[^>]*href="(https:\/\/github\.com\/[^"]+)"[^>]*>GitHub<\/a>/i,
								/<a[^>]*href="(https:\/\/github\.com\/[^"]+)"[^>]*>/i,
								/href="(https:\/\/github\.com\/[^"]+)"/i,
								/<a[^>]*href="(https:\/\/gitlab\.com\/[^"]+)"[^>]*>/i,
								/<a[^>]*href="(https:\/\/bitbucket\.org\/[^"]+)"[^>]*>/i,
							];

							for (const pattern of repoPatterns) {
								const match = data.match(pattern);
								if (match) {
									repository = match[1];
									// Clean up GitHub URLs
									if (repository.includes('github.com')) {
										repository = repository
											.replace(/\/tree\/.*$/, '')
											.replace(/\/blob\/.*$/, '');
									}
									break;
								}
							}

							resolve({
								license,
								repository,
								homepage: `https://pkg.go.dev/${packageName}`,
								description: 'Go module',
							});
						} else {
							resolve(null);
						}
					} catch (error) {
						reject(error);
					}
				});
			});

			request.on('error', error => {
				reject(error);
			});

			request.setTimeout(config.timeout || 5000, () => {
				request.destroy();
				reject(new Error('Timeout'));
			});
		});
	}

	private static async fetchLicenseText(
		repoUrlOrPackage: string
	): Promise<string | null> {
		// Try to extract GitHub repository from Go module path
		const githubMatch = repoUrlOrPackage.match(/github\.com\/([^\/]+\/[^\/]+)/);
		if (!githubMatch) {
			return null;
		}

		const repoPath = githubMatch[1];
		const possibleLicenseFiles = [
			'LICENSE',
			'LICENSE.txt',
			'LICENSE.md',
			'COPYING',
			'license',
		];

		for (const licenseFile of possibleLicenseFiles) {
			try {
				const licenseText = await this.fetchGitHubFile(repoPath, licenseFile);
				if (licenseText) {
					return licenseText;
				}
			} catch (error) {
				// Continue to next license file
			}
		}

		return null;
	}

	private static async fetchGitHubFile(
		repoPath: string,
		fileName: string
	): Promise<string | null> {
		return new Promise(resolve => {
			const url = `https://raw.githubusercontent.com/${repoPath}/main/${fileName}`;

			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					if (response.statusCode === 200) {
						resolve(data);
					} else {
						// Try master branch
						const masterUrl = `https://raw.githubusercontent.com/${repoPath}/master/${fileName}`;
						const masterRequest = https.get(masterUrl, masterResponse => {
							let masterData = '';
							masterResponse.on('data', chunk => {
								masterData += chunk;
							});
							masterResponse.on('end', () => {
								if (masterResponse.statusCode === 200) {
									resolve(masterData);
								} else {
									resolve(null);
								}
							});
						});
						masterRequest.on('error', () => resolve(null));
						masterRequest.setTimeout(3000, () => {
							masterRequest.destroy();
							resolve(null);
						});
					}
				});
			});

			request.on('error', () => resolve(null));
			request.setTimeout(3000, () => {
				request.destroy();
				resolve(null);
			});
		});
	}
}

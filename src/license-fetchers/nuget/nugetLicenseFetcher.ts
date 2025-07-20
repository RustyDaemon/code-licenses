import * as https from 'https';
import * as xml2js from 'xml2js';
import { ConfigurationManager } from '../../configurationManager';
import { LicenseInfo } from '../../types';

export class NugetLicenseFetcher {
	/**
	 * Fetch license information for NuGet packages
	 */
	public static async fetchLicenseInfo(
		dependency: LicenseInfo
	): Promise<LicenseInfo> {
		return new Promise(resolve => {
			const packageName = dependency.name;
			const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
			const config = ConfigurationManager.getFetchingConfig();

			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', async () => {
					try {
						const packageInfo = JSON.parse(data);
						if (packageInfo.versions && packageInfo.versions.length > 0) {
							// Get the latest version or specified version
							const targetVersion =
								dependency.version !== 'Unknown'
									? dependency.version
									: packageInfo.versions[packageInfo.versions.length - 1];

							// Fetch the package metadata for the specific version
							const metadataUrl = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/${targetVersion}/${packageName.toLowerCase()}.nuspec`;

							try {
								const licenseInfo = await this.fetchNuGetMetadata(metadataUrl);

								// Ensure all fields are strings, not objects
								const license =
									typeof licenseInfo.license === 'string'
										? licenseInfo.license
										: licenseInfo.license
										? String(licenseInfo.license)
										: 'See NuGet Gallery';

								const repository =
									typeof licenseInfo.repository === 'string'
										? licenseInfo.repository
										: licenseInfo.repository
										? String(licenseInfo.repository)
										: `https://www.nuget.org/packages/${packageName}`;

								const homepage =
									typeof licenseInfo.homepage === 'string'
										? licenseInfo.homepage
										: licenseInfo.homepage
										? String(licenseInfo.homepage)
										: `https://www.nuget.org/packages/${packageName}`;

								const description =
									typeof licenseInfo.description === 'string'
										? licenseInfo.description
										: licenseInfo.description
										? String(licenseInfo.description)
										: 'NuGet package';

								resolve({
									...dependency,
									license,
									repository,
									homepage,
									description,
									licenseText: licenseInfo.licenseText,
								});
							} catch (metadataError) {
								// Fallback to basic info
								resolve({
									...dependency,
									license: 'See NuGet Gallery',
									repository: `https://www.nuget.org/packages/${packageName}`,
									homepage: `https://www.nuget.org/packages/${packageName}`,
								});
							}
						} else {
							resolve({
								...dependency,
								license: 'Unknown',
							});
						}
					} catch (error) {
						console.error(
							`Error parsing NuGet package info for ${packageName}:`,
							error
						);
						resolve({
							...dependency,
							license: 'Unknown',
						});
					}
				});
			});

			request.on('error', error => {
				console.error(
					`Error fetching NuGet package info for ${packageName}:`,
					error
				);
				resolve({
					...dependency,
					license: 'Unknown',
				});
			});

			// Set timeout
			request.setTimeout(config.timeout, () => {
				request.destroy();
				resolve({
					...dependency,
					license: 'Timeout',
				});
			});
		});
	}

	private static async fetchNuGetMetadata(metadataUrl: string): Promise<{
		license?: string;
		repository?: string;
		homepage?: string;
		description?: string;
		licenseText?: string;
	}> {
		return new Promise(resolve => {
			const config = ConfigurationManager.getFetchingConfig();
			const request = https.get(metadataUrl, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					try {
						// Parse the .nuspec XML file
						const parser = new xml2js.Parser();

						parser.parseString(data, (err: any, result: any) => {
							if (err) {
								resolve({});
								return;
							}

							const metadata = result?.package?.metadata?.[0];
							if (metadata) {
								// Extract package name from metadata URL for fallback URLs
								const packageName = metadataUrl.split('/')[4]; // Extract from URL structure

								// Extract license - handle both string and object cases
								let license = 'See NuGet Gallery';
								console.log(
									'Full metadata:',
									JSON.stringify(metadata, null, 2)
								);

								if (metadata.license?.[0]) {
									const licenseValue = metadata.license[0];
									console.log(
										'License value:',
										licenseValue,
										typeof licenseValue
									);

									if (typeof licenseValue === 'string') {
										license = licenseValue;
									} else if (typeof licenseValue === 'object') {
										// Handle xml2js object structure
										license =
											licenseValue._ ||
											licenseValue.$ ||
											licenseValue.toString() ||
											'See NuGet Gallery';
									}
								} else if (metadata.licenseUrl?.[0]) {
									const licenseUrlValue = metadata.licenseUrl[0];
									console.log(
										'License URL value:',
										licenseUrlValue,
										typeof licenseUrlValue
									);

									if (typeof licenseUrlValue === 'string') {
										license = licenseUrlValue;
									} else if (typeof licenseUrlValue === 'object') {
										license =
											licenseUrlValue._ ||
											licenseUrlValue.$ ||
											licenseUrlValue.toString() ||
											'See NuGet Gallery';
									}
								}

								// Extract repository - handle both string and object cases
								let repository = `https://www.nuget.org/packages/${packageName}`;
								if (metadata.repository?.[0]) {
									const repoValue = metadata.repository[0];
									console.log('Repository value:', repoValue, typeof repoValue);

									if (typeof repoValue === 'string') {
										repository = repoValue;
									} else if (typeof repoValue === 'object') {
										repository =
											repoValue._ ||
											repoValue.$ ||
											repoValue.url ||
											repoValue.toString() ||
											`https://www.nuget.org/packages/${packageName}`;
									}
								} else if (metadata.projectUrl?.[0]) {
									const projUrlValue = metadata.projectUrl[0];
									console.log(
										'Project URL value:',
										projUrlValue,
										typeof projUrlValue
									);

									if (typeof projUrlValue === 'string') {
										repository = projUrlValue;
									} else if (typeof projUrlValue === 'object') {
										repository =
											projUrlValue._ ||
											projUrlValue.$ ||
											projUrlValue.toString() ||
											`https://www.nuget.org/packages/${packageName}`;
									}
								}

								// Extract homepage - handle both string and object cases
								let homepage = `https://www.nuget.org/packages/${packageName}`;
								if (metadata.projectUrl?.[0]) {
									const projUrlValue = metadata.projectUrl[0];
									console.log(
										'Homepage value:',
										projUrlValue,
										typeof projUrlValue
									);

									if (typeof projUrlValue === 'string') {
										homepage = projUrlValue;
									} else if (typeof projUrlValue === 'object') {
										homepage =
											projUrlValue._ ||
											projUrlValue.$ ||
											projUrlValue.toString() ||
											`https://www.nuget.org/packages/${packageName}`;
									}
								}

								// Extract description - handle both string and object cases
								let description = 'NuGet package';
								if (metadata.description?.[0]) {
									const desc = metadata.description[0];
									description =
										typeof desc === 'string'
											? desc
											: desc.$ || desc._text || 'NuGet package';
								}

								resolve({
									license,
									repository,
									homepage,
									description,
								});
							} else {
								resolve({});
							}
						});
					} catch (error) {
						resolve({});
					}
				});
			});

			request.on('error', () => {
				resolve({});
			});

			request.setTimeout(config.timeout, () => {
				request.destroy();
				resolve({});
			});
		});
	}
}

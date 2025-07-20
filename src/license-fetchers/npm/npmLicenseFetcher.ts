import * as https from 'https';
import { ConfigurationManager } from '../../configurationManager';
import { LicenseInfo } from '../../types';

export class NpmLicenseFetcher {
	/**
	 * Fetch license information for NPM packages
	 */
	public static async fetchLicenseInfo(
		dependency: LicenseInfo
	): Promise<LicenseInfo> {
		return new Promise(resolve => {
			const packageName = dependency.name;
			const url = `https://registry.npmjs.org/${encodeURIComponent(
				packageName
			)}`;
			const config = ConfigurationManager.getFetchingConfig();

			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					try {
						const packageInfo = JSON.parse(data);
						const latestVersion = packageInfo['dist-tags']?.latest;
						const versionInfo =
							packageInfo.versions?.[latestVersion] ||
							packageInfo.versions?.[
								Object.keys(packageInfo.versions || {})[0]
							];

						resolve({
							...dependency,
							license: versionInfo?.license || 'Unknown',
							repository:
								packageInfo.repository?.url || versionInfo?.repository?.url,
							homepage: packageInfo.homepage || versionInfo?.homepage,
							description: packageInfo.description || versionInfo?.description,
						});
					} catch (error) {
						console.error(
							`Error parsing npm package info for ${packageName}:`,
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
					`Error fetching npm package info for ${packageName}:`,
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
}

import * as https from 'https';
import { ConfigurationManager } from '../../configurationManager';
import { LicenseInfo } from '../../types';

export class CratesLicenseFetcher {
	/**
	 * Fetch license information for Rust crates from crates.io
	 */
	public static async fetchLicenseInfo(
		dependency: LicenseInfo
	): Promise<LicenseInfo> {
		return new Promise(resolve => {
			const packageName = dependency.name;
			const url = `https://crates.io/api/v1/crates/${encodeURIComponent(
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
						const crateInfo = JSON.parse(data);
						const crate = crateInfo.crate;

						// Handle license field - it might be null, string, or array
						let license = 'Unknown';
						if (crate?.license) {
							if (Array.isArray(crate.license)) {
								license = crate.license.join(' OR ');
							} else {
								license = String(crate.license);
							}
						} else if (crate?.license_file) {
							license = 'See license file';
						}

						// Ensure we have fallbacks for all fields
						const repository =
							crate?.repository || `https://crates.io/crates/${packageName}`;
						const homepage = crate?.homepage || repository;
						const description = crate?.description || 'Rust crate';

						resolve({
							...dependency,
							license,
							repository,
							homepage,
							description,
						});
					} catch (error) {
						console.error(
							`Error parsing crates.io info for ${packageName}:`,
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
					`Error fetching crates.io info for ${packageName}:`,
					error
				);
				resolve({
					...dependency,
					license: 'Unknown',
				});
			});

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

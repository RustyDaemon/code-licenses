import * as https from 'https';
import { ConfigurationManager } from '../../configurationManager';
import { LicenseInfo } from '../../types';

export class PythonLicenseFetcher {
	/**
	 * Fetch license information for Python packages from PyPI
	 */
	public static async fetchLicenseInfo(
		dependency: LicenseInfo
	): Promise<LicenseInfo> {
		return new Promise(resolve => {
			const packageName = dependency.name;
			const url = `https://pypi.org/pypi/${encodeURIComponent(
				packageName
			)}/json`;
			const config = ConfigurationManager.getFetchingConfig();

			const request = https.get(url, response => {
				let data = '';

				response.on('data', chunk => {
					data += chunk;
				});

				response.on('end', () => {
					try {
						const packageInfo = JSON.parse(data);
						const info = packageInfo.info;

						// Extract license from classifier or license field
						let license = info.license || 'Unknown';

						if (info.classifiers && Array.isArray(info.classifiers)) {
							const licenseClassifiers = info.classifiers
								.filter((c: string) => c.startsWith('License ::'))
								.map((c: string) => c.replace('License :: ', ''));

							if (licenseClassifiers.length > 0) {
								license = licenseClassifiers.join(', ');
							}
						}

						resolve({
							...dependency,
							license,
							repository:
								info.project_urls?.Repository || info.project_urls?.Source,
							homepage: info.home_page || info.project_urls?.Homepage,
							description: info.summary,
						});
					} catch (error) {
						console.error(
							`Error parsing PyPI package info for ${packageName}:`,
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
					`Error fetching PyPI package info for ${packageName}:`,
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

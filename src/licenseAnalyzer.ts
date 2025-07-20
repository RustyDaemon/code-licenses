import {
	CratesLicenseFetcher,
	GoLicenseFetcher,
	NpmLicenseFetcher,
	NugetLicenseFetcher,
	PythonLicenseFetcher,
} from './license-fetchers';
import { LicenseCache } from './licenseCache';
import { LicenseInfo, ProjectType } from './types';

export class LicenseAnalyzer {
	/**
	 * Analyzes and fetches license information for dependencies
	 */
	public async analyzeLicenses(
		dependencies: LicenseInfo[],
		projectType: ProjectType
	): Promise<LicenseInfo[]> {
		const analyzedDependencies: LicenseInfo[] = [];

		for (const dependency of dependencies) {
			try {
				const licenseInfo = await this.fetchLicenseInfo(
					dependency,
					projectType
				);
				analyzedDependencies.push(licenseInfo);
			} catch (error) {
				console.error(`Error fetching license for ${dependency.name}:`, error);
				analyzedDependencies.push({
					...dependency,
					license: 'Unknown',
				});
			}
		}

		return analyzedDependencies;
	}

	private async fetchLicenseInfo(
		dependency: LicenseInfo,
		projectType: ProjectType
	): Promise<LicenseInfo> {
		// Check cache first
		const cached = LicenseCache.getCachedLicenseInfo(
			dependency.name,
			dependency.version,
			projectType
		);

		if (cached) {
			return cached;
		}

		let licenseInfo: LicenseInfo;

		switch (projectType) {
			case ProjectType.JavaScript:
			case ProjectType.TypeScript:
			case ProjectType.React:
				licenseInfo = await NpmLicenseFetcher.fetchLicenseInfo(dependency);
				break;

			case ProjectType.CSharp:
				licenseInfo = await NugetLicenseFetcher.fetchLicenseInfo(dependency);
				break;

			case ProjectType.Rust:
				licenseInfo = await CratesLicenseFetcher.fetchLicenseInfo(dependency);
				break;

			case ProjectType.Go:
				licenseInfo = await GoLicenseFetcher.fetchLicenseInfo(dependency);
				break;

			case ProjectType.Python:
				licenseInfo = await PythonLicenseFetcher.fetchLicenseInfo(dependency);
				break;

			default:
				licenseInfo = {
					...dependency,
					license: 'Unknown',
				};
		}

		// Cache the result
		LicenseCache.cacheLicenseInfo(
			dependency.name,
			dependency.version,
			projectType,
			licenseInfo
		);

		return licenseInfo;
	}

	/**
	 * Groups licenses by type for easier analysis
	 */
	public groupLicensesByType(
		dependencies: LicenseInfo[]
	): Map<string, LicenseInfo[]> {
		const licenseGroups = new Map<string, LicenseInfo[]>();

		for (const dependency of dependencies) {
			const license = dependency.license || 'Unknown';
			if (!licenseGroups.has(license)) {
				licenseGroups.set(license, []);
			}
			licenseGroups.get(license)!.push(dependency);
		}

		return licenseGroups;
	}

	/**
	 * Identifies potentially problematic licenses
	 */
	public identifyProblematicLicenses(
		dependencies: LicenseInfo[]
	): LicenseInfo[] {
		const problematicLicenses = [
			'GPL-2.0',
			'GPL-3.0',
			'AGPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
		];

		return dependencies.filter(dep =>
			problematicLicenses.some(license =>
				dep.license.toLowerCase().includes(license.toLowerCase())
			)
		);
	}
}

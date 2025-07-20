import { LicenseCompatibility } from './types';

export class LicenseCompatibilityAnalyzer {
	private static readonly COMPATIBILITY_MATRIX: { [key: string]: string[] } = {
		MIT: [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'BSD-2-Clause': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'BSD-3-Clause': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'Apache-2.0': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'GPL-2.0': ['GPL-2.0', 'LGPL-2.1'],
		'GPL-3.0': ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0'],
		'LGPL-2.1': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'LGPL-3.0': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		'MPL-2.0': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
		],
		ISC: [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
			'ISC',
		],
		Unlicense: [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
			'ISC',
			'Unlicense',
		],
		'CC0-1.0': [
			'MIT',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'Apache-2.0',
			'GPL-2.0',
			'GPL-3.0',
			'LGPL-2.1',
			'LGPL-3.0',
			'MPL-2.0',
			'ISC',
			'Unlicense',
			'CC0-1.0',
		],
	};

	private static readonly INCOMPATIBLE_REASONS: { [key: string]: string } = {
		'GPL-2.0-Apache-2.0':
			'GPL 2.0 is incompatible with Apache 2.0 due to patent and termination clause differences',
		'GPL-2.0-GPL-3.0':
			'GPL 2.0 cannot be upgraded to GPL 3.0 without explicit permission',
	};

	/**
	 * Check if two licenses are compatible
	 */
	public static checkCompatibility(
		license1: string,
		license2: string
	): LicenseCompatibility {
		const normalizedLicense1 = this.normalizeLicenseName(license1);
		const normalizedLicense2 = this.normalizeLicenseName(license2);

		if (normalizedLicense1 === normalizedLicense2) {
			return {
				license1: normalizedLicense1,
				license2: normalizedLicense2,
				compatible: true,
				reason: 'Same license',
			};
		}

		const compatible1 =
			this.COMPATIBILITY_MATRIX[normalizedLicense1]?.includes(
				normalizedLicense2
			) || false;
		const compatible2 =
			this.COMPATIBILITY_MATRIX[normalizedLicense2]?.includes(
				normalizedLicense1
			) || false;

		const compatible = compatible1 && compatible2;

		let reason: string | undefined;
		if (!compatible) {
			const reasonKey1 = `${normalizedLicense1}-${normalizedLicense2}`;
			const reasonKey2 = `${normalizedLicense2}-${normalizedLicense1}`;
			reason =
				this.INCOMPATIBLE_REASONS[reasonKey1] ||
				this.INCOMPATIBLE_REASONS[reasonKey2] ||
				'Licenses may have incompatible terms and conditions';
		}

		return {
			license1: normalizedLicense1,
			license2: normalizedLicense2,
			compatible,
			reason,
		};
	}

	/**
	 * Analyze compatibility across all licenses in a project
	 */
	public static analyzeProjectCompatibility(licenses: string[]): {
		compatible: boolean;
		issues: LicenseCompatibility[];
		matrix: LicenseCompatibility[][];
	} {
		const uniqueLicenses = Array.from(
			new Set(licenses.map(l => this.normalizeLicenseName(l)))
		);
		const issues: LicenseCompatibility[] = [];
		const matrix: LicenseCompatibility[][] = [];

		for (let i = 0; i < uniqueLicenses.length; i++) {
			const row: LicenseCompatibility[] = [];
			for (let j = 0; j < uniqueLicenses.length; j++) {
				const compatibility = this.checkCompatibility(
					uniqueLicenses[i],
					uniqueLicenses[j]
				);
				row.push(compatibility);

				if (i < j && !compatibility.compatible) {
					issues.push(compatibility);
				}
			}
			matrix.push(row);
		}

		return {
			compatible: issues.length === 0,
			issues,
			matrix,
		};
	}

	/**
	 * Get risk level for a license combination
	 */
	public static getRiskLevel(licenses: string[]): 'low' | 'medium' | 'high' {
		const hasGPL = licenses.some(l => l.toLowerCase().includes('gpl'));
		const hasAGPL = licenses.some(l => l.toLowerCase().includes('agpl'));
		const hasCommercialIncompatible = licenses.some(l =>
			['GPL-3.0', 'AGPL-3.0', 'GPL-2.0'].includes(this.normalizeLicenseName(l))
		);

		if (hasAGPL) {
			return 'high';
		}
		if (hasGPL && hasCommercialIncompatible) {
			return 'high';
		}
		if (hasCommercialIncompatible) {
			return 'medium';
		}
		return 'low';
	}

	/**
	 * Get recommendations for license compatibility issues
	 */
	public static getRecommendations(licenses: string[]): string[] {
		const recommendations: string[] = [];
		const analysis = this.analyzeProjectCompatibility(licenses);

		if (!analysis.compatible) {
			recommendations.push('Review incompatible licenses in your dependencies');

			const hasGPL = licenses.some(l => l.toLowerCase().includes('gpl'));
			if (hasGPL) {
				recommendations.push(
					"Consider if GPL licenses are compatible with your project's distribution model"
				);
			}

			const hasAGPL = licenses.some(l => l.toLowerCase().includes('agpl'));
			if (hasAGPL) {
				recommendations.push(
					'AGPL requires source code disclosure even for web services - ensure compliance'
				);
			}

			if (analysis.issues.length > 0) {
				recommendations.push(
					'Consider replacing dependencies with incompatible licenses'
				);
				recommendations.push(
					'Consult with legal counsel for commercial projects'
				);
			}
		}

		return recommendations;
	}

	private static normalizeLicenseName(license: string): string {
		if (!license || license === 'Unknown' || license === 'Timeout') {
			return license;
		}

		// Common license name variations
		const normalizations: { [key: string]: string } = {
			mit: 'MIT',
			bsd: 'BSD-3-Clause',
			'bsd-2': 'BSD-2-Clause',
			'bsd-3': 'BSD-3-Clause',
			apache: 'Apache-2.0',
			'apache-2': 'Apache-2.0',
			'gpl-2': 'GPL-2.0',
			'gpl-3': 'GPL-3.0',
			'lgpl-2.1': 'LGPL-2.1',
			'lgpl-3': 'LGPL-3.0',
			'mpl-2': 'MPL-2.0',
			mozilla: 'MPL-2.0',
			isc: 'ISC',
		};

		const lowerLicense = license.toLowerCase();
		return normalizations[lowerLicense] || license;
	}
}

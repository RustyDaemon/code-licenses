import * as fs from 'fs';
import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import { LicenseInfo, ProjectInfo, ProjectType } from './types';

export class DependencyScanner {
	/**
	 * Scans dependencies from project files
	 */
	public async scanDependencies(project: ProjectInfo): Promise<LicenseInfo[]> {
		try {
			switch (project.type) {
				case ProjectType.JavaScript:
				case ProjectType.TypeScript:
				case ProjectType.React:
					return await this.scanPackageJson(project.dependencyFile);

				case ProjectType.CSharp:
					if (project.dependencyFile.endsWith('.csproj')) {
						return await this.scanCsproj(project.dependencyFile);
					} else if (project.dependencyFile.endsWith('packages.config')) {
						return await this.scanPackagesConfig(project.dependencyFile);
					}
					break;

				case ProjectType.Rust:
					return await this.scanCargoToml(project.dependencyFile);

				case ProjectType.Go:
					return await this.scanGoMod(project.dependencyFile);

				case ProjectType.Python:
					return await this.scanRequirementsTxt(project.dependencyFile);

				default:
					vscode.window.showWarningMessage(
						`Unsupported project type: ${project.type}`
					);
					return [];
			}
		} catch (error) {
			console.error(`Error scanning dependencies for ${project.name}:`, error);
			vscode.window.showErrorMessage(`Error scanning dependencies: ${error}`);
		}

		return [];
	}

	private async scanPackageJson(
		packageJsonPath: string
	): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(packageJsonPath, 'utf-8');
			const packageJson = JSON.parse(content);
			const dependencies: LicenseInfo[] = [];

			// Process dependencies
			if (packageJson.dependencies) {
				for (const [name, version] of Object.entries(
					packageJson.dependencies
				)) {
					dependencies.push({
						name,
						version: version as string,
						license: 'Unknown', // Will be fetched later
					});
				}
			}

			// Process devDependencies
			if (packageJson.devDependencies) {
				for (const [name, version] of Object.entries(
					packageJson.devDependencies
				)) {
					dependencies.push({
						name,
						version: version as string,
						license: 'Unknown', // Will be fetched later
					});
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse package.json: ${error}`);
		}
	}

	private async scanCsproj(csprojPath: string): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(csprojPath, 'utf-8');
			const parser = new xml2js.Parser();
			const result = await parser.parseStringPromise(content);
			const dependencies: LicenseInfo[] = [];

			// Look for PackageReference elements
			const project = result.Project;
			if (project && project.ItemGroup) {
				for (const itemGroup of project.ItemGroup) {
					if (itemGroup.PackageReference) {
						for (const packageRef of itemGroup.PackageReference) {
							const attrs = packageRef.$;
							if (attrs && attrs.Include) {
								dependencies.push({
									name: attrs.Include,
									version: attrs.Version || 'Unknown',
									license: 'Unknown', // Will be fetched later
								});
							}
						}
					}
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse .csproj file: ${error}`);
		}
	}

	private async scanPackagesConfig(
		packagesConfigPath: string
	): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(packagesConfigPath, 'utf-8');
			const parser = new xml2js.Parser();
			const result = await parser.parseStringPromise(content);
			const dependencies: LicenseInfo[] = [];

			// Look for package elements
			if (result.packages && result.packages.package) {
				for (const pkg of result.packages.package) {
					const attrs = pkg.$;
					if (attrs && attrs.id) {
						dependencies.push({
							name: attrs.id,
							version: attrs.version || 'Unknown',
							license: 'Unknown', // Will be fetched later
						});
					}
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse packages.config: ${error}`);
		}
	}

	private async scanCargoToml(cargoTomlPath: string): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(cargoTomlPath, 'utf-8');
			const dependencies: LicenseInfo[] = [];

			// Parse TOML manually (simple approach for dependencies section)
			const lines = content.split('\n');
			let inDependenciesSection = false;
			let inDevDependenciesSection = false;

			for (const line of lines) {
				const trimmedLine = line.trim();

				// Check for section headers
				if (trimmedLine === '[dependencies]') {
					inDependenciesSection = true;
					inDevDependenciesSection = false;
					continue;
				} else if (trimmedLine === '[dev-dependencies]') {
					inDependenciesSection = false;
					inDevDependenciesSection = true;
					continue;
				} else if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
					inDependenciesSection = false;
					inDevDependenciesSection = false;
					continue;
				}

				// Parse dependency lines
				if (
					(inDependenciesSection || inDevDependenciesSection) &&
					trimmedLine.includes('=')
				) {
					const [name, versionPart] = trimmedLine.split('=', 2);
					const cleanName = name.trim();
					let version = 'Unknown';

					if (versionPart) {
						// Handle different version formats: "1.0.0", { version = "1.0.0" }, etc.
						const versionMatch = versionPart.match(/["']([^"']+)["']/);
						if (versionMatch) {
							version = versionMatch[1];
						}
					}

					if (cleanName && !cleanName.startsWith('#')) {
						dependencies.push({
							name: cleanName,
							version,
							license: 'Unknown', // Will be fetched later
						});
					}
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse Cargo.toml: ${error}`);
		}
	}

	private async scanGoMod(goModPath: string): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(goModPath, 'utf-8');
			const dependencies: LicenseInfo[] = [];
			const lines = content.split('\n');

			let inRequireBlock = false;

			for (const line of lines) {
				const trimmedLine = line.trim();

				// Check for require block
				if (trimmedLine === 'require (') {
					inRequireBlock = true;
					continue;
				} else if (trimmedLine === ')' && inRequireBlock) {
					inRequireBlock = false;
					continue;
				}

				// Parse dependency lines (both inline and block format)
				if (trimmedLine.startsWith('require ') || inRequireBlock) {
					let depLine = trimmedLine;
					if (depLine.startsWith('require ')) {
						depLine = depLine.substring(8).trim();
					}

					// Skip indirect dependencies (marked with // indirect)
					if (depLine.includes('// indirect')) {
						continue;
					}

					// Remove comments
					depLine = depLine.split('//')[0].trim();

					if (depLine && !depLine.startsWith('//')) {
						const parts = depLine.split(/\s+/);
						if (parts.length >= 2) {
							const name = parts[0];
							const version = parts[1];

							dependencies.push({
								name,
								version,
								license: 'Unknown', // Will be fetched later
							});
						}
					}
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse go.mod: ${error}`);
		}
	}

	private async scanRequirementsTxt(
		requirementsTxtPath: string
	): Promise<LicenseInfo[]> {
		try {
			const content = fs.readFileSync(requirementsTxtPath, 'utf-8');
			const dependencies: LicenseInfo[] = [];
			const lines = content.split('\n');

			for (const line of lines) {
				const trimmedLine = line.trim();

				// Skip empty lines and comments
				if (!trimmedLine || trimmedLine.startsWith('#')) {
					continue;
				}

				// Parse different formats: package==version, package>=version, package, etc.
				let name = '';
				let version = 'Unknown';

				// Handle various operators: ==, >=, <=, >, <, !=, ~=, ===
				const operators = ['===', '==', '>=', '<=', '!=', '~=', '>', '<'];
				let found = false;

				for (const op of operators) {
					if (trimmedLine.includes(op)) {
						const [packageName, packageVersion] = trimmedLine.split(op, 2);
						name = packageName.trim();
						version = packageVersion ? packageVersion.trim() : 'Unknown';
						found = true;
						break;
					}
				}

				if (!found) {
					// No version specifier
					name = trimmedLine;
					version = 'Unknown';
				}

				// Remove any additional specifiers (like [extra])
				name = name.split('[')[0].trim();

				if (name) {
					dependencies.push({
						name,
						version,
						license: 'Unknown', // Will be fetched later
					});
				}
			}

			return dependencies;
		} catch (error) {
			throw new Error(`Failed to parse requirements.txt: ${error}`);
		}
	}
}

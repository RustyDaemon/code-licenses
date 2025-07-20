import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectInfo, ProjectType } from './types';

export class ProjectDetector {
	/**
	 * Detects the project type based on files present in the workspace
	 */
	public async detectProjects(workspacePath: string): Promise<ProjectInfo[]> {
		const projects: ProjectInfo[] = [];

		try {
			// First check the root directory itself
			await this.detectProjectsInDirectory(workspacePath, projects);

			// Then recursively check subdirectories (up to 3 levels deep to avoid performance issues)
			await this.detectProjectsRecursively(workspacePath, projects, 0, 3);

			// Deduplicate projects based on path
			const uniqueProjects = this.deduplicateProjects(projects);
			return uniqueProjects;
		} catch (error) {
			console.error('Error detecting projects:', error);
			vscode.window.showErrorMessage(`Error detecting projects: ${error}`);
		}

		return [];
	}

	/**
	 * Recursively detect projects in subdirectories
	 */
	private async detectProjectsRecursively(
		dirPath: string,
		projects: ProjectInfo[],
		currentDepth: number,
		maxDepth: number
	): Promise<void> {
		if (currentDepth >= maxDepth) {
			return;
		}

		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
					const subDirPath = path.join(dirPath, entry.name);

					// Check this subdirectory for projects
					await this.detectProjectsInDirectory(subDirPath, projects);

					// Recursively check deeper
					await this.detectProjectsRecursively(
						subDirPath,
						projects,
						currentDepth + 1,
						maxDepth
					);
				}
			}
		} catch (error) {
			// Ignore permission errors and continue
			console.warn(`Could not read directory ${dirPath}:`, error);
		}
	}

	/**
	 * Check if directory should be skipped during recursive detection
	 */
	private shouldSkipDirectory(dirName: string): boolean {
		const skipDirs = [
			'node_modules',
			'.git',
			'.vscode',
			'dist',
			'build',
			'out',
			'target',
			'bin',
			'obj',
			'.next',
			'.nuxt',
			'vendor',
			'__pycache__',
			'.pytest_cache',
		];
		return skipDirs.includes(dirName) || dirName.startsWith('.');
	}

	/**
	 * Detect projects in a specific directory
	 */
	private async detectProjectsInDirectory(
		dirPath: string,
		projects: ProjectInfo[]
	): Promise<void> {
		try {
			// Check for package.json (JavaScript/TypeScript/React)
			const packageJsonPath = path.join(dirPath, 'package.json');
			if (fs.existsSync(packageJsonPath)) {
				const projectType = await this.detectJSProjectType(packageJsonPath);
				projects.push({
					type: projectType,
					name: path.basename(dirPath),
					path: dirPath,
					dependencyFile: packageJsonPath,
					dependencies: [],
				});
			}

			// Check for C# project files
			const csprojFiles = this.findFiles(dirPath, '*.csproj');
			for (const csprojFile of csprojFiles) {
				projects.push({
					type: ProjectType.CSharp,
					name: path.basename(csprojFile, '.csproj'),
					path: path.dirname(csprojFile),
					dependencyFile: csprojFile,
					dependencies: [],
				});
			}

			// Check for packages.config (legacy NuGet)
			const packagesConfigPath = path.join(dirPath, 'packages.config');
			if (fs.existsSync(packagesConfigPath)) {
				projects.push({
					type: ProjectType.CSharp,
					name: `${path.basename(dirPath)} (packages.config)`,
					path: dirPath,
					dependencyFile: packagesConfigPath,
					dependencies: [],
				});
			}

			// Check for Rust projects (Cargo.toml)
			const cargoTomlPath = path.join(dirPath, 'Cargo.toml');
			if (fs.existsSync(cargoTomlPath)) {
				projects.push({
					type: ProjectType.Rust,
					name: path.basename(dirPath),
					path: dirPath,
					dependencyFile: cargoTomlPath,
					dependencies: [],
				});
			}

			// Check for Go projects (go.mod)
			const goModPath = path.join(dirPath, 'go.mod');
			if (fs.existsSync(goModPath)) {
				projects.push({
					type: ProjectType.Go,
					name: path.basename(dirPath),
					path: dirPath,
					dependencyFile: goModPath,
					dependencies: [],
				});
			}

			// Check for Python projects (requirements.txt)
			const requirementsTxtPath = path.join(dirPath, 'requirements.txt');
			if (fs.existsSync(requirementsTxtPath)) {
				projects.push({
					type: ProjectType.Python,
					name: path.basename(dirPath),
					path: dirPath,
					dependencyFile: requirementsTxtPath,
					dependencies: [],
				});
			}
		} catch (error) {
			console.error(`Error detecting projects in ${dirPath}:`, error);
		}
	}

	private async detectJSProjectType(
		packageJsonPath: string
	): Promise<ProjectType> {
		try {
			const content = fs.readFileSync(packageJsonPath, 'utf-8');
			const packageJson = JSON.parse(content);

			// Check if it's a React project
			const dependencies = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
			};
			if (dependencies.react || dependencies['@types/react']) {
				return ProjectType.React;
			}

			// Check if it's TypeScript
			if (
				dependencies.typescript ||
				dependencies['@types/node'] ||
				fs.existsSync(path.join(path.dirname(packageJsonPath), 'tsconfig.json'))
			) {
				return ProjectType.TypeScript;
			}

			return ProjectType.JavaScript;
		} catch (error) {
			console.error('Error detecting JS project type:', error);
			return ProjectType.JavaScript;
		}
	}

	private findFiles(dir: string, pattern: string): string[] {
		const results: string[] = [];

		try {
			const files = fs.readdirSync(dir);

			for (const file of files) {
				const fullPath = path.join(dir, file);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip node_modules and other common directories
					if (!['node_modules', '.git', 'bin', 'obj'].includes(file)) {
						results.push(...this.findFiles(fullPath, pattern));
					}
				} else if (this.matchesPattern(file, pattern)) {
					results.push(fullPath);
				}
			}
		} catch (error) {
			console.error(`Error reading directory ${dir}:`, error);
		}

		return results;
	}

	private matchesPattern(filename: string, pattern: string): boolean {
		// Simple pattern matching for *.extension
		if (pattern.startsWith('*.')) {
			const extension = pattern.substring(1);
			return filename.endsWith(extension);
		}
		return filename === pattern;
	}

	/**
	 * Remove duplicate projects based on dependency file path
	 */
	private deduplicateProjects(projects: ProjectInfo[]): ProjectInfo[] {
		const uniqueProjects = new Map<string, ProjectInfo>();

		for (const project of projects) {
			// Use the normalized dependency file path as the key
			const key = path.normalize(project.dependencyFile);

			// If we haven't seen this dependency file before, or if this project has a shorter name (likely the main one)
			if (
				!uniqueProjects.has(key) ||
				project.name.length < uniqueProjects.get(key)!.name.length
			) {
				uniqueProjects.set(key, project);
			}
		}

		return Array.from(uniqueProjects.values());
	}
}

import { join } from 'path';
import { mkdir, cp, rm, writeFile, readFile } from 'fs/promises';
import {existsSync} from 'fs'
import * as tar from 'tar'; 
import { execSync } from 'child_process';
import ProgressBar from 'progress';
import { spawn } from 'child_process';
import os from 'os'

export async function createContainer(name: string, source: string) {
  const containerPath = join(process.cwd(), name);
  if (existsSync(containerPath)) throw new Error(`Container ${name} already exists`);
  await mkdir(containerPath, { recursive: true });
  await cp(source, containerPath, { recursive: true });
  await writeFile(join(containerPath, 'cryo.json'), JSON.stringify({ name, created: Date.now() }));
}

export async function removeContainer(name: string) {
  const dir = join(process.cwd(), name);
  if (!existsSync(dir)) throw new Error(`Container ${name} not found`);
  //await rm(dir, { recursive: true, force: true });
}

export async function exportContainer(name: string) {
  const dir = join(process.cwd(), name);
  if (!existsSync(dir)) throw new Error(`Container ${name} not found`);

  const outputFile = join(process.cwd(), `${name}.cryo`);
  const packageJsonPath = join(dir, 'package.json');

  let dependencies = {};
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    dependencies = {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    };
  } else {
    await writeFile(packageJsonPath, JSON.stringify({ name, version: '1.0.0', dependencies: {} }));
  }

  const nodeModulesPath = join(dir, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    await rm(nodeModulesPath, { recursive: true, force: true });
  }

  await tar.create(
    {
      gzip: true,
      file: outputFile,
      cwd: process.cwd(),
    },
    [name]
  );
}

export async function importContainer(file: string) {
  const filePath = join(process.cwd(), file);
  if (!existsSync(filePath) || !file.endsWith('.cryo')) {
    throw new Error(`Invalid or missing .cryo file: ${file}`);
  }

  const name = file.replace('.cryo', '');
  const containerPath = join(process.cwd(), name);
  if (existsSync(containerPath)) throw new Error(`Container ${name} already exists`);

  await tar.extract({ file: filePath, cwd: process.cwd() });

  const packageJsonPath = join(containerPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    console.log(`Installing dependencies for ${name}...`);
    try {
      execSync('npm install', { cwd: containerPath, stdio: 'inherit' });
      console.log(`Dependencies installed for ${name}`);
    } catch (err) {
      throw new Error(`Failed to install dependencies: ${err}`);
    }
  } else {
    console.log(`No package.json found in ${name}, skipping dependency installation`);
  }
}

export async function readLogs(name: string): Promise<string> {
  const logFile = join(process.cwd(), name, 'cryo.log');
  if (!existsSync(logFile)) throw new Error(`No logs found for ${name}`);
  return readFile(logFile, 'utf8');
}
import { join } from 'path';
import { mkdir, cp, rm, writeFile, readFile } from 'fs/promises';
import {existsSync} from 'fs';
import tar from 'tar';
import { execSync, spawn } from 'child_process';
import ProgressBar from 'progress';

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
  await rm(dir, { recursive: true, force: true });
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

  await tar.c({ gzip: true, file: outputFile }, [name]);
}

export async function importContainer(file: string) {
  const filePath = join(process.cwd(), file);
  if (!existsSync(filePath) || !file.endsWith('.cryo')) {
    throw new Error(`Invalid or missing .cryo file: ${file}`);
  }

  const name = file.replace('.cryo', '');
  const containerPath = join(process.cwd(), name);
  if (existsSync(containerPath)) throw new Error(`Container ${name} already exists`);

  await tar.x({ file: filePath, cwd: process.cwd() });

  const packageJsonPath = join(containerPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    console.log(`Installing dependencies for ${name}...`);
    const bar = new ProgressBar('[:bar] :percent :etas', { total: 50, width: 20 });
    const installProcess = spawn('npm', ['install'], { cwd: containerPath });
    
    installProcess.stdout?.on('data', () => bar.tick());
    installProcess.stderr?.on('data', () => bar.tick());
    installProcess.on('close', () => bar.total === bar.curr ? bar.tick(50 - bar.curr) : null);

    await new Promise((resolve, reject) => {
      installProcess.on('close', (code) => {
        if (code === 0) resolve(null);
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });
    console.log(`Dependencies installed for ${name}`);
  }
}

export async function readLogs(name: string): Promise<string> {
  const logFile = join(process.cwd(), name, 'cryo.log');
  if (!existsSync(logFile)) throw new Error(`No logs found for ${name}`);
  return readFile(logFile, 'utf8');
}
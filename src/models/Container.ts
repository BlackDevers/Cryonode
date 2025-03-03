import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs'
import { config } from 'dotenv';
import { createWriteStream } from 'fs';
import pidusage from 'pidusage';

export class Container {
  private static containers: Map<string, Container> = new Map();
  private cwd = process.cwd();

  pid: number;
  proc: ChildProcess;
  file: string;
  port?: number;
  memoryLimit?: number;

  constructor(pid: number, proc: ChildProcess, file: string, port?: number, memoryLimit?: number) {
    this.pid = pid;
    this.proc = proc;
    this.file = file;
    this.port = port;
    this.memoryLimit = memoryLimit;
  }

  static async start(name: string, port?: number, memoryLimit?: number): Promise<Container> {
    const dir = join(process.cwd(), name);
    if(!existsSync(dir)) throw new Error(`Container ${name} not found`);
    if(this.containers.has(name)) throw new Error(`Container ${name} already running`);

    const envPath = join(dir, '.env');
    let env = existsSync(envPath) ? config({ path: envPath }).parsed : {};
    if(port) {
        process.env.PORT = port.toString();
    }

    const files = await readdir(dir);
    const mainFile = files.find(f => f === 'index.js') || 
                    files.find(f => f.endsWith('.js') || f.endsWith('.ts'));
    if(!mainFile) throw new Error('No executable file found');

    const proc = spawn('node', [mainFile], { cwd: dir, env: { ...process.env, ...env } });
    const logStream = createWriteStream(join(dir, 'cryo.log'), { flags: 'a' });
    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);

    const container = new Container(proc.pid!, proc, mainFile, port, memoryLimit);
    this.containers.set(name, container);

    proc.on('error', () => this.tryNextFile(name, files, dir, [mainFile]));
    proc.on('exit', () => this.containers.delete(name));

    if (memoryLimit) {
      setInterval(async () => {
        const stats = await pidusage(proc.pid!);
        if (stats.memory / 1024 / 1024 > memoryLimit) {
          console.log(`Container ${name} exceeded memory limit (${memoryLimit} MB), stopping...`);
          container.stop();
        }
      }, 1000);
    }

    return container;
  }

  private static async tryNextFile(name: string, files: string[], dir: string, exclude: string[]) {
    const nextFile = files.find(f => (f.endsWith('.js') || f.endsWith('.ts')) && !exclude.includes(f));
    if (!nextFile) {
      this.containers.delete(name);
      throw new Error('No more executable files to try');
    }
    const proc = spawn('node', [nextFile], { cwd: dir });
    const container = new Container(proc.pid!, proc, nextFile);
    this.containers.set(name, container);
    proc.on('error', () => this.tryNextFile(name, files, dir, [...exclude, nextFile]));
  }

  static get(name: string): Container | undefined {
    return this.containers.get(name);
  }

  static list(): Map<string, Container> {
    return this.containers;
  }

  stop() {
    this.proc.kill();
    Container.containers.delete(this.getName());
  }

  private getName(): string {
    for (const [name, container] of Container.containers) {
      if (container === this) return name;
    }
    return '';
  }
}
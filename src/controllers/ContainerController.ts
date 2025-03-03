import { Container } from '../models/Container';
import { createContainer, removeContainer, exportContainer, importContainer, readLogs } from '../utils/fileUtils';
import { compileContainer } from '../utils/processUtils';
import pidusage from 'pidusage';
import chokidar from 'chokidar';

export class ContainerController {
  async create(name: string, source: string) {
    await createContainer(name, source);
    console.log(`Container ${name} created from ${source}`);
  }

  async start(name: string, port?: number, memoryLimit?: number) {
    const container = await Container.start(name, port, memoryLimit);
    console.log(`Started container ${name} with ${container.file} (PID: ${container.pid})`);
  }

  async list() {
    const containers = Container.list();
    if (containers.size === 0) {
      console.log('No active containers');
      return;
    }
    for (const [name, container] of containers) {
      const stats = await pidusage(container.pid);
      console.log({
        name,
        pid: container.pid,
        localId: `${name}-${container.pid}`,
        memory: `${(stats.memory / 1024 / 1024).toFixed(2)} MB`,
        cpu: `${stats.cpu.toFixed(2)}%`,
        file: container.file,
        port: container.port || 'N/A',
        uptime: `${(stats.elapsed / 1000).toFixed(2)}s`
      });
    }
  }

  stop(name: string) {
    const container = Container.get(name);
    if (!container) throw new Error(`Container ${name} not running`);
    container.stop();
    console.log(`Stopped container ${name}`);
  }

  async remove(name: string) {
    const container = Container.get(name);
    if (container) container.stop();
    await removeContainer(name);
    console.log(`Removed container ${name}`);
  }

  async dev(name: string) {
    await Container.start(name);
    const watcher = chokidar.watch(name, { ignored: 'cryo.json' });
    watcher.on('change', async () => {
      console.log('File changed, restarting...');
      this.stop(name);
      await Container.start(name);
    });
  }

  async export(name: string) {
    await exportContainer(name);
    console.log(`Container ${name} exported to ${name}.cryo (without node_modules)`);
  }

  async import(file: string) {
    await importContainer(file);
    console.log(`Container ${file.replace('.cryo', '')} imported from ${file}`);
  }

  async compile(name: string) {
    await compileContainer(name);
  }

  async logs(name: string) {
    const logs = await readLogs(name);
    console.log(logs);
  }
}
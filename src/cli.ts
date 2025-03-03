#!/usr/bin/env ts-node
import { program } from 'commander';
import { ContainerController } from './controllers/ContainerController';

const controller = new ContainerController();

program
  .command('create-container <name> <source>')
  .description('Create a new container from source directory')
  .action(async (name: string, source: string) => {
    try {
      await controller.create(name, source);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('start <name>')
  .option('-p, --port <port>', 'Port to bind', parseInt)
  .option('-m, --memory-limit <mb>', 'Memory limit in MB', parseInt)
  .description('Start a container')
  .action(async (name: string, options: { port?: number; memoryLimit?: number }) => {
    try {
      await controller.start(name, options.port, options.memoryLimit);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('active')
  .description('List active containers')
  .action(async () => {
    try {
      await controller.list();
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('stop <name>')
  .description('Stop a running container')
  .action((name: string) => {
    try {
      controller.stop(name);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('remove <name>')
  .description('Remove a container')
  .action(async (name: string) => {
    try {
      await controller.remove(name);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('dev <name>')
  .description('Run container in dev mode with hot reload')
  .action(async (name: string) => {
    try {
      await controller.dev(name);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('export <name>')
  .description('Export a container to a .cryo file without node_modules')
  .action(async (name: string) => {
    try {
      await controller.export(name);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('import <file>')
  .description('Import a container from a .cryo file and install dependencies')
  .action(async (file: string) => {
    try {
      await controller.import(file);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('compile <name>')
  .description('Compile a container into a bundled JS file or executable binary')
  .action(async (name: string) => {
    try {
      await controller.compile(name);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('logs <name>')
  .description('Show logs of a container')
  .action(async (name: string) => {
    try {
      await controller.logs(name);
    } catch (err) {
      console.error(err);
    }
  });

program.parse(process.argv);
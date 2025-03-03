import { join } from 'path';
import { rm } from 'fs/promises';
import { existsSync } from 'fs'
import { execSync } from 'child_process';
import { readdir } from 'fs/promises';
import esbuild from 'esbuild';

export async function compileContainer(name: string) {
  const dir = join(process.cwd(), name);
  if (!existsSync(dir)) throw new Error(`Container ${name} not found`);

  const files = await readdir(dir);
  const mainFile = files.find(f => f === 'index.js') || 
                  files.find(f => f.endsWith('.js') || f.endsWith('.ts'));
  if (!mainFile) throw new Error('No executable file found');

  const inputPath = join(dir, mainFile);
  const bundlePath = join(process.cwd(), `${name}-bundle.js`);
  const outputPath = join(process.cwd(), `${name}-compiled`);

  await esbuild.build({
    entryPoints: [inputPath],
    bundle: true,
    platform: 'node',
    outfile: bundlePath,
    minify: true,
    sourcemap: false,
  });
  console.log(`Container ${name} bundled to ${bundlePath}`);

  try {
    execSync(`npx pkg ${bundlePath} --output ${outputPath} --targets node18-linux-x64`, { stdio: 'inherit' });
    console.log(`Container ${name} compiled to ${outputPath}`);
    await rm(bundlePath);
  } catch (err) {
    console.log(`Compilation to binary failed: ${err}`);
    console.log(`To compile to an executable, install pkg globally: npm install -g pkg`);
    console.log(`Then run: npx pkg ${bundlePath} --output ${outputPath} --targets node18-linux-x64`);
  }
}
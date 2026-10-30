import {build} from 'esbuild';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.JAIME_DIST_DIR ? path.resolve(process.env.JAIME_DIST_DIR,'secure') : path.resolve(root,'../app/dist/secure');
await mkdir(path.join(out,'pkg'),{recursive:true});
const wasmPath=path.join(root,'node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm');
const wasmBytes=await readFile(wasmPath);
const wasmName=`matrix-crypto-18.9.0-${createHash('sha256').update(wasmBytes).digest('hex').slice(0,16)}.wasm`;
const result = await build({absWorkingDir:root,entryPoints:{messenger:'messenger-ui.mjs',universos:'universos-ui.mjs',taurino:'taurino-ui.mjs'},outdir:out,bundle:true,format:'esm',platform:'browser',target:['safari16.4'],minify:true,sourcemap:false,metafile:true,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'pinned-crypto-asset',setup(build){build.onLoad({filter:/matrix-sdk-crypto-wasm\/index\.mjs$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('./pkg/matrix_sdk_crypto_wasm_bg.wasm','./pkg/'+wasmName),loader:'js',resolveDir:path.dirname(args.path)}));}}]});
await copyFile(wasmPath,path.join(out,'pkg',wasmName));
const names = ['matrix-js-sdk','@matrix-org/matrix-sdk-crypto-wasm'];
const notices = [];
for (const name of names) {
  const base = path.join(root,'node_modules',name);
  const pkg = JSON.parse(await readFile(path.join(base,'package.json'),'utf8'));
  notices.push(`${name} ${pkg.version}\nLicense: ${pkg.license}\n${pkg.homepage || pkg.repository?.url || ''}\n`);
  try {notices.push(await readFile(path.join(base,'LICENSE'),'utf8'));} catch {}
}
await writeFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),notices.join('\n\n'));
await writeFile(path.join(root,'build-metadata.json'),JSON.stringify({sdk:'45.0.0',crypto:'18.9.0',wasmFile:'secure/pkg/'+wasmName,inputs:Object.keys(result.metafile.inputs),outputs:Object.fromEntries(Object.entries(result.metafile.outputs).map(([k,v])=>[path.basename(k),{bytes:v.bytes}]))},null,2)+'\n');
console.log('Secure client built, local scripts and crypto WASM only.');

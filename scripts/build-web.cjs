/* Copy an explicit web allowlist, never the repository, SDK, or credentials. */
const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
async function build() {
  const output = path.join(root, 'www');
  await fs.rm(output, {recursive:true, force:true});
  await fs.mkdir(output, {recursive:true});
  const files = ['style.css','workspace.css','ui.css','script.js','workspace.js','workbench.js','ui.js','tutorial.js','mobile.js','install.js','manifest.webmanifest','VERSION'];
  for (const file of files) await fs.copyFile(path.join(root,file), path.join(output,file));
  for (const directory of ['core','assets']) await fs.cp(path.join(root,directory),path.join(output,directory),{recursive:true,filter:source=>!source.endsWith('.DS_Store')});
  await fs.copyFile(path.join(root,'native','native.css'), path.join(output,'native.css'));
  const html = (await fs.readFile(path.join(root,'index.html'),'utf8'))
    .replace(/<link[^>]+rel="preconnect"[^>]*>\s*/g,'')
    .replace('</head>', '  <link rel="stylesheet" href="./native.css">\n</head>')
    .replace('  <script src="./core/voice-parser.js">', '  <script src="./native-bridge.js"></script>\n  <script src="./core/voice-parser.js">');
  if (!html.includes('src="./native-bridge.js"')) throw new Error('Native bridge insertion point missing');
  await fs.writeFile(path.join(output,'index.html'),html);
  const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  const notices=[];
  for(const name of Object.keys(metadata.dependencies)){
    const license=await fs.readFile(path.join(root,'node_modules',name,'LICENSE'),'utf8');
    notices.push(`${name}\n${license}`);
  }
  await fs.writeFile(path.join(output,'THIRD_PARTY_NOTICES.txt'),notices.join('\n\n'));
  await esbuild.build({entryPoints:[path.join(root,'native','bridge.js')],bundle:true,format:'iife',platform:'browser',target:['safari15','chrome90'],outfile:path.join(output,'native-bridge.js'),legalComments:'eof'});
  console.log('Bundled local web assets and native adapters in www/');
}
build().catch(error=>{console.error(error);process.exitCode=1;});

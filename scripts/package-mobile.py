#!/usr/bin/env python3
"""Package shareable sources, never build caches, local settings, or signing keys."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
output = root / 'dist'
output.mkdir(exist_ok=True)
archive = output / 'speechflow-mobile-source.zip'
exclude_dirs = {'.git', '.gradle', '.idea', 'build', 'DerivedData', 'Pods', 'node_modules', 'output', 'xcuserdata', '__pycache__'}
exclude_suffixes = {'.jks', '.keystore', '.p12', '.p8', '.pem', '.key', '.mobileprovision', '.apk', '.aab', '.log'}
files = [root / name for name in ['package.json', 'package-lock.json', 'capacitor.config.json', '.gitignore', '.gitattributes', 'README.md', 'MOBILE.md', 'VOICE_COMMAND_TEST_GUIDE.md', 'index.html', 'VERSION']]
files += list(root.glob('*.js')) + list(root.glob('*.css'))
for name in ['android', 'ios', 'native', 'scripts', 'core', 'assets', 'tests']:
    for item in (root / name).rglob('*'):
        relative = item.relative_to(root)
        if item.is_file() and not any(part in exclude_dirs or part.startswith('capacitor-cordova-') for part in relative.parts):
            files.append(item)
with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as bundle:
    for item in sorted(set(files)):
        if item.name in {'local.properties', '.DS_Store'} or item.name.startswith('.env') or item.suffix in exclude_suffixes:
            continue
        if item.is_symlink():
            raise RuntimeError(f'Refusing symlink in bundle: {item}')
        bundle.write(item, 'speechflow/' + item.relative_to(root).as_posix())
print(f'{archive} ({archive.stat().st_size:,} bytes)')

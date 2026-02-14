const fs = require('fs');
const path = require('path');

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

const projectRoot = path.resolve(__dirname, '..');
const srcConfig = path.join(projectRoot, 'staticwebapp.config.json');
const outConfig = path.join(projectRoot, 'web-build', 'staticwebapp.config.json');

const copied = copyIfExists(srcConfig, outConfig);
if (copied) {
  console.log('Copied staticwebapp.config.json -> web-build/staticwebapp.config.json');
} else {
  console.warn('staticwebapp.config.json not found; SPA deep links may 404 on Azure Static Web Apps');
}

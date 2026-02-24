/**
 * Generate app icons and splash screen from favicon.svg
 * 
 * Required: sharp (available globally via sharp-cli)
 * 
 * Generates:
 *   - icon.png (1024x1024) — iOS App Store icon
 *   - adaptive-icon.png (1024x1024) — Android adaptive icon foreground
 *   - splash.png (1284x2778) — Universal splash screen
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SVG_PATH = path.join(ASSETS_DIR, 'favicon.svg');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // 1. icon.png — 1024x1024 (iOS App Store requirement)
  console.log('Generating icon.png (1024x1024)...');
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));

  // 2. adaptive-icon.png — 1024x1024 (Android adaptive icon foreground)
  //    Needs ~30% padding around logo for safe zone
  console.log('Generating adaptive-icon.png (1024x1024 with padding)...');
  const logoResized = await sharp(svgBuffer)
    .resize(680, 680)  // ~66% of 1024 to leave safe zone padding
    .png()
    .toBuffer();
  
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: '#3B82F6',
    }
  })
    .composite([{ input: logoResized, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));

  // 3. splash.png — 1284x2778 (iPhone 14 Pro Max resolution)
  //    Logo centered on brand gradient background
  console.log('Generating splash.png (1284x2778)...');
  const splashLogo = await sharp(svgBuffer)
    .resize(400, 400)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1284,
      height: 2778,
      channels: 4,
      background: '#0066FF',
    }
  })
    .composite([{ input: splashLogo, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash.png'));

  console.log('✅ All icons generated successfully!');
}

generateIcons().catch(console.error);

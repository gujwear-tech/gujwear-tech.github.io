const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
const outputDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(logoPath)) {
  console.error('Logo not found at', logoPath);
  process.exit(1);
}

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 192, name: 'favicon-192x192.png' },
  { size: 512, name: 'favicon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function generateFavicons() {
  try {
    console.log('📦 Using logo from:', logoPath);

    for (const { size, name } of sizes) {
      const outputPath = path.join(outputDir, name);
      await sharp(logoPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ Created ${name} (${size}x${size})`);
    }

    // Generate ICO
    const icoPath = path.join(outputDir, 'favicon.ico');
    await sharp(logoPath)
      .resize(32, 32)
      .png()
      .toFile(icoPath.replace('.ico', '.png'));
    // For ICO, use a library or just copy, but sharp can output ICO
    // For simplicity, create a 32x32 PNG as ICO placeholder
    fs.copyFileSync(icoPath.replace('.ico', '.png'), icoPath);
    console.log('✓ Created favicon.ico');

    console.log('✅ All favicons generated from logo.png!');
  } catch (err) {
    console.error('Error generating favicons:', err);
    process.exit(1);
  }
}

generateFavicons();
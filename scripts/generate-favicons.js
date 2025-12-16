const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  const logoPaths = [
    path.join(__dirname, '..', 'assets', 'logo.png'),
  ];
  
  // Find which logo path exists
  let logoPath = null;
  for (const p of logoPaths) {
    if (fs.existsSync(p)) {
      logoPath = p;
      break;
    }
  }
  
  if (!logoPath) {
    console.error('❌ Error: logo.png not found in assets/');
    process.exit(1);
  }

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-192x192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-512x512.png', size: 512 }
  ];

  try {
    console.log(`📦 Using logo from: ${logoPath}`);
    
    for (const { name, size } of sizes) {
      const outputPath = path.join(__dirname, '..', 'assets', name);
      
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 5, g: 13, b: 26, alpha: 1 } // #050d1a background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created assets/${name} (${size}x${size})`);
    }

    // Create favicon.ico from 32x32 version (better detail at small sizes)
    const favicon32Path = path.join(__dirname, '..', 'assets', 'favicon-32x32.png');
    const faviconIcoPath = path.join(__dirname, '..', 'assets', 'favicon.ico');
    
    await sharp(favicon32Path)
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 5, g: 13, b: 26, alpha: 1 }
      })
      .png()
      .toFile(faviconIcoPath);
    
    console.log(`✓ Created assets/favicon.ico`);
    console.log('\n✅ All favicons generated from logo.png!');
  } catch (err) {
    console.error('❌ Error generating favicons:', err.message);
    process.exit(1);
  }
}

generateFavicons();

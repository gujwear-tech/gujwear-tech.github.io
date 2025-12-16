const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ACCENT_COLOR = '#ff6b35';
const BG_COLOR = '#050d1a';

// SVG favicon template with GW monogram
const svgTemplate = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
  
  <!-- Gradient circle background -->
  <defs>
    <radialGradient id="grad" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color:${ACCENT_COLOR};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff5722;stop-opacity:1" />
    </radialGradient>
  </defs>
  
  <!-- Circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="url(#grad)"/>
  
  <!-- Text "GW" -->
  <text x="${size/2}" y="${size/2 + size * 0.15}" 
        font-family="Arial, sans-serif" 
        font-size="${Math.floor(size * 0.5)}" 
        font-weight="bold"
        fill="white" 
        text-anchor="middle"
        dominant-baseline="middle">GW</text>
</svg>`;

async function generateFavicons() {
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-192x192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-512x512.png', size: 512 }
  ];

  try {
    for (const { name, size } of sizes) {
      const svg = svgTemplate(size);
      const outputPath = path.join(__dirname, '..', name);
      
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created ${name} (${size}x${size})`);
    }

    // Create favicon.ico from 16x16
    const favicon16Path = path.join(__dirname, '..', 'favicon-16x16.png');
    const faviconIcoPath = path.join(__dirname, '..', 'favicon.ico');
    
    await sharp(favicon16Path)
      .resize(32, 32)
      .toFile(faviconIcoPath);
    
    console.log(`✓ Created favicon.ico`);
    console.log('\n🎉 All favicons generated successfully!');
  } catch (err) {
    console.error('Error generating favicons:', err);
    process.exit(1);
  }
}

generateFavicons();

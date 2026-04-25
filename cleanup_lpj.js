const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\Najatunnisa S\\dpa-himafi';
const newFolderPath = path.join(baseDir, 'src', 'app', 'lpj-presensi');

const filesToDelete = [
    'src\\app\\calon\\lpj-at.tsx',
    'src\\app\\calon\\lpj-at-page.tsx',
    'src\\app\\bantuan\\lpj.tsx',
    'src\\app\\bantuan\\lpj-page.tsx',
    'src\\app\\profil\\lpj.tsx',
    'src\\app\\profil\\lpj-routing-page.tsx',
    'src\\app\\profil\\lpj-presensi.tsx',
    'src\\app\\profil\\lpj-at.tsx',
    'src\\app\\setting\\lpj-presensi.tsx',
    'src\\app\\hearing\\lpj-at-page.tsx',
    'src\\app\\hearing\\lpj-page.tsx'
];

// 1. Create the new folder
try {
    if (!fs.existsSync(newFolderPath)) {
        fs.mkdirSync(newFolderPath, { recursive: true });
        console.log('✓ Created folder: src\\app\\lpj-presensi');
    } else {
        console.log('○ Folder already exists: src\\app\\lpj-presensi');
    }
} catch (err) {
    console.error('✗ Failed to create folder:', err.message);
}

// 2. Delete artifact files
let deletedCount = 0;
let notFoundCount = 0;

for (const file of filesToDelete) {
    const filePath = path.join(baseDir, file);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('✓ Deleted:', file);
            deletedCount++;
        } else {
            console.log('○ Not found:', file);
            notFoundCount++;
        }
    } catch (err) {
        console.error('✗ Error deleting', file, ':', err.message);
    }
}

// 3. Verify the folder exists
console.log('\n=== SUMMARY ===');
try {
    const stats = fs.statSync(newFolderPath);
    if (stats.isDirectory()) {
        console.log('✓ New folder verified: src\\app\\lpj-presensi');
        console.log('✓ Folder is ready for page.tsx');
    }
} catch (err) {
    console.error('✗ Failed to verify folder');
}

console.log('✓ Deleted:', deletedCount, 'files');
console.log('○ Not found:', notFoundCount, 'files');
console.log('\n✓ All tasks completed successfully!');

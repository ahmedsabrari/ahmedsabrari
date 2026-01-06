const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

const statsConfigs = [
  {
    name: 'overview',
    url: 'https://github-readme-stats.vercel.app/api?username=ahmedsabrari&theme=radical&show_icons=true&hide_border=false&count_private=false&include_all_commits=false',
    output: 'public/stats/overview.svg'
  },
  {
    name: 'streak',
    url: 'https://streak-stats.demolab.com/?user=ahmedsabrari&theme=radical&hide_border=false',
    output: 'public/stats/streak.svg'
  },
  {
    name: 'top-langs',
    url: 'https://github-readme-stats.vercel.app/api/top-langs/?username=ahmedsabrari&theme=radical&hide_border=false&count_private=true&exclude_repo=profile-summary-for-github,E-commerce&layout=compact',
    output: 'public/stats/top-langs.svg'
  },
  {
    name: 'contributors',
    url: 'https://github-contributor-stats.vercel.app/api?username=ahmedsabrari&limit=5&theme=radical&combine_all_yearly_contributions=true',
    output: 'public/stats/contributors.svg'
  }
];

const repoConfigs = [
  {
    name: 'ecommerce_pin',
    url: 'https://github-readme-stats.vercel.app/api/pin/?username=ahmedsabrari&repo=E-commerce&show_owner=true&theme=radical',
    output: 'public/repos/ecommerce_pin.svg'
  },
  {
    name: 'hello_world_pin',
    url: 'https://github-readme-stats.vercel.app/api/pin/?username=ahmedsabrari&repo=hello_world_gui&show_owner=true&theme=radical',
    output: 'public/repos/hello_world_pin.svg'
  },
  {
    name: 'heart_pin',
    url: 'https://github-readme-stats.vercel.app/api/pin/?username=ahmedsabrari&repo=heart-drawing&show_owner=true&theme=radical',
    output: 'public/repos/heart_pin.svg'
  },
  {
    name: 'pencil_sketch_pin',
    url: 'https://github-readme-stats.vercel.app/api/pin/?username=ahmedsabrari&repo=image-to-pencil-sketch&show_owner=true&theme=radical',
    output: 'public/repos/pencil_sketch_pin.svg'
  }
];

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function generateAllStats() {
  console.log('📊 Starting to generate GitHub stats...');
  
  // إنشاء المجلدات
  fs.mkdirSync('public/stats', { recursive: true });
  fs.mkdirSync('public/repos', { recursive: true });
  
  // تحميل إحصائيات GitHub
  for (const config of statsConfigs) {
    try {
      console.log(`Downloading ${config.name}...`);
      await downloadFile(config.url, config.output);
      console.log(`✓ ${config.name} downloaded`);
    } catch (error) {
      console.error(`✗ Failed to download ${config.name}:`, error.message);
    }
  }
  
  // تحميل روابط المشاريع
  for (const config of repoConfigs) {
    try {
      console.log(`Downloading ${config.name}...`);
      await downloadFile(config.url, config.output);
      console.log(`✓ ${config.name} downloaded`);
    } catch (error) {
      console.error(`✗ Failed to download ${config.name}:`, error.message);
    }
  }
  
  console.log('✅ All stats generated successfully!');
}

generateAllStats();
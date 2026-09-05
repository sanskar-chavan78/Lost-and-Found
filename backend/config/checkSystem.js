const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dns = require('dns');

// Fallback to Google and Cloudflare DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // ignore
}

console.log('========================================================');
console.log('        Lost & Found Portal - Diagnostics System        ');
console.log('========================================================\n');

function printResult(name, status, details = '') {
  const reset = '\x1b[0m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const red = '\x1b[31m';
  
  let statusStr = '';
  if (status === 'PASS') statusStr = `${green}[PASS]${reset}`;
  else if (status === 'WARNING') statusStr = `${yellow}[WARNING]${reset}`;
  else if (status === 'ERROR') statusStr = `${red}[ERROR]${reset}`;
  else statusStr = `[${status}]`;

  console.log(`${statusStr} ${name} ${details ? '- ' + details : ''}`);
}

// 1. Check Node.js
try {
  const nodeVer = execSync('node -v').toString().trim();
  printResult('Node.js Installation', 'PASS', `Version ${nodeVer}`);
} catch (e) {
  printResult('Node.js Installation', 'ERROR', 'Node.js is not found on path.');
}

// 2. Check npm
try {
  const npmVer = execSync('npm -v').toString().trim();
  printResult('npm Installation', 'PASS', `Version ${npmVer}`);
} catch (e) {
  printResult('npm Installation', 'ERROR', 'npm is not found on path.');
}

// 3. Check backend package.json
const backendPkgPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(backendPkgPath)) {
  printResult('Backend package.json', 'PASS', 'Verified file existence.');
} else {
  printResult('Backend package.json', 'ERROR', 'backend/package.json is missing.');
}

// 4. Check backend node_modules
const backendModulesPath = path.join(__dirname, '..', 'node_modules');
const modulesInstalled = fs.existsSync(backendModulesPath);
if (modulesInstalled) {
  printResult('Backend Dependencies', 'PASS', 'node_modules directory found.');
} else {
  printResult('Backend Dependencies', 'ERROR', 'node_modules is missing. Run INSTALL.bat.');
}

// 5. Check frontend structure
const frontendIndexPath = path.join(__dirname, '..', '..', 'frontend', 'index.html');
if (fs.existsSync(frontendIndexPath)) {
  printResult('Frontend Structure', 'PASS', 'frontend/index.html verified.');
} else {
  printResult('Frontend Structure', 'ERROR', 'frontend/index.html is missing.');
}

// 6. Check .env config
const envRootPath = path.join(__dirname, '..', '..', '.env');
let envContent = '';
if (fs.existsSync(envRootPath)) {
  envContent = fs.readFileSync(envRootPath, 'utf8');
  printResult('Root .env File', 'PASS', 'Verified file existence.');
} else {
  printResult('Root .env File', 'ERROR', 'Root .env file is missing. Run INSTALL.bat.');
}

// 7. Check JWT_SECRET & MONGODB_URI in env
if (envContent) {
  const hasJwt = /JWT_SECRET=/.test(envContent) && !/JWT_SECRET=\s*$/.test(envContent);
  const hasMongo = (/MONGODB_URI=/.test(envContent) || /MONGO_URI=/.test(envContent)) && 
                   !/MONGODB_URI=\s*$/.test(envContent) && !/MONGO_URI=\s*$/.test(envContent);
  const isTemplateJwt = /YOUR_JWT_SECRET/.test(envContent);
  const isTemplateMongo = /YOUR_MONGODB_ATLAS_URI/.test(envContent);

  if (hasJwt && !isTemplateJwt) {
    printResult('JWT_SECRET Variable', 'PASS', 'Configuration verified.');
  } else if (isTemplateJwt) {
    printResult('JWT_SECRET Variable', 'WARNING', 'Currently set to default template placeholder.');
  } else {
    printResult('JWT_SECRET Variable', 'ERROR', 'JWT_SECRET is missing from .env.');
  }

  if (hasMongo && !isTemplateMongo) {
    printResult('MONGODB_URI Variable', 'PASS', 'Configuration verified.');
  } else if (isTemplateMongo) {
    printResult('MONGODB_URI Variable', 'WARNING', 'Currently set to default template placeholder.');
  } else {
    printResult('MONGODB_URI Variable', 'ERROR', 'MONGODB_URI is missing from .env.');
  }
}

// 8. Check upload folder
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(uploadsPath)) {
  printResult('Uploads Folder', 'PASS', 'backend/uploads verified.');
} else {
  printResult('Uploads Folder', 'WARNING', 'backend/uploads directory is missing. Server will create it on boot.');
}

// 9. Check port status
console.log('\nChecking service ports (Ports 5000 and 3000)...');
try {
  // Use netstat to check ports
  const netstat = execSync('netstat -ano').toString();
  const port5000InUse = netstat.includes(':5000 ');
  const port3000InUse = netstat.includes(':3000 ');

  printResult('Port 5000 Status (Backend)', port5000InUse ? 'WARNING' : 'PASS', port5000InUse ? 'In use (backend might already be running)' : 'Available');
  printResult('Port 3000 Status (Frontend)', port3000InUse ? 'WARNING' : 'PASS', port3000InUse ? 'In use (frontend might already be running)' : 'Available');
} catch (e) {
  printResult('Port Status Check', 'WARNING', 'Could not run port scan check.');
}

// 10. Test MongoDB connection if mongoose is available and URI is configured
let mongoose;
if (modulesInstalled) {
  try {
    mongoose = require('mongoose');
  } catch (e) {
    // ignore
  }
}

let dbUri = '';
if (envContent) {
  const mongoMatch = envContent.match(/MONGODB_URI=([^\r\n]+)/) || envContent.match(/MONGO_URI=([^\r\n]+)/);
  if (mongoMatch) {
    dbUri = mongoMatch[1].trim();
  }
}
if (mongoose && dbUri && !/YOUR_/.test(dbUri)) {
  console.log('\nTesting MongoDB Atlas connectivity (this may take a few seconds)...');
  mongoose.connect(dbUri)
    .then(() => {
      printResult('MongoDB Atlas Connection', 'PASS', 'Connected successfully.');
      runFinished();
    })
    .catch((err) => {
      printResult('MongoDB Atlas Connection', 'ERROR', `Failed to connect. Reason: ${err.message}`);
      console.log('\nNOTE: If you get querySrv ECONNREFUSED, your local DNS might block SRV records.');
      console.log('If you get IP restriction errors, authorize this IP in MongoDB Atlas Security Settings.');
      runFinished();
    });
} else {
  printResult('MongoDB Atlas Connection', 'WARNING', 'Connection test skipped (dependencies not installed or template credentials used).');
  runFinished();
}

function runFinished() {
  console.log('\n========================================================');
  console.log('Diagnostics execution finished.');
  console.log('========================================================');
  process.exit(0);
}

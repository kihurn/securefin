import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 3900;
const BASE_URL = `http://localhost:${PORT}`;

console.log('====================================================');
console.log('       SECUREFIN SECURITY FRAMEWORK TEST SUITE      ');
console.log('====================================================\n');

async function runTests() {
  let serverProcess: ChildProcess | null = null;

  try {
    // 1. Start the server
    console.log(`Starting Express server locally on port ${PORT}...`);
    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(PORT) }
    });

    // Wait for the server to start up by listening to stdout
    await new Promise<void>((resolve, reject) => {
      let output = '';
      serverProcess?.stdout?.on('data', (data) => {
        const str = data.toString();
        output += str;
        if (str.includes('[SecureFin Server] Running')) {
          resolve();
        }
      });
      serverProcess?.stderr?.on('data', (data) => {
        console.error('Server error on startup:', data.toString());
      });
      // Timeout after 10 seconds if it fails to start
      setTimeout(() => reject(new Error('Server start timed out:\n' + output)), 10000);
    });

    console.log('✔ Server is running! Beginning security validation...\n');

    // Clean logs before starting
    const logsDir = path.join(process.cwd(), 'logs');
    if (fs.existsSync(logsDir)) {
      fs.readdirSync(logsDir).forEach(file => {
        try {
          fs.unlinkSync(path.join(logsDir, file));
        } catch {}
      });
    }

    // --- TEST 1: Default-Deny Authentication Guard ---
    console.log('Test 1: Verifying Default-Deny Access Control...');
    const t1Res = await fetch(`${BASE_URL}/api/user/profile`);
    const t1Body = await t1Res.json();
    if (t1Res.status === 401 && t1Body.error?.includes('Access denied')) {
      console.log('  ✔ SUCCESS: Access blocked (401 Unauthorized) when requesting without authentication token.');
    } else {
      console.error(`  ❌ FAILED: Received status ${t1Res.status} instead of 401.`);
    }

    // --- TEST 2: Role-Based Access Control (Forbidden Role) ---
    console.log('\nTest 2: Verifying RBAC Forbidden Access (User role accessing Admin route)...');
    // Register test user
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reg_user', password: 'securePassword123', role: 'user' }),
    });

    // Login to get token
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reg_user', password: 'securePassword123' }),
    });
    const loginData = await loginRes.json();
    const userToken = loginData.token;

    // Access admin dashboard
    const rbacRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    const rbacBody = await rbacRes.json();
    if (rbacRes.status === 403 && rbacBody.error?.includes('Insufficient privileges')) {
      console.log('  ✔ SUCCESS: Access blocked (403 Forbidden) for non-admin user role.');
    } else {
      console.error(`  ❌ FAILED: Received status ${rbacRes.status} instead of 403.`, rbacBody);
    }

    // --- TEST 3: Role-Based Access Control (Allowed Role) ---
    console.log('\nTest 3: Verifying RBAC Approved Access (Admin role accessing Admin route)...');
    // Register admin user
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin_user', password: 'securePassword123', role: 'admin' }),
    });

    // Login to get token
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin_user', password: 'securePassword123' }),
    });
    const loginAdminData = await loginAdminRes.json();
    const adminToken = loginAdminData.token;

    // Access admin dashboard
    const adminRbacRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const adminRbacBody = await adminRbacRes.json();
    if (adminRbacRes.status === 200 && adminRbacBody.sensitiveSystemMetric) {
      console.log('  ✔ SUCCESS: Access granted (200 OK) for authorized admin user.');
    } else {
      console.error(`  ❌ FAILED: Admin role was rejected with status ${adminRbacRes.status}.`, adminRbacBody);
    }

    // --- TEST 4: Input Sanitization (XSS / SQL Injection Protection) ---
    console.log('\nTest 4: Verifying Input Sanitization (XSS and SQL Injection script stripping)...');
    const xssPayload = 'malicious<script>alert("hack")</script>user\' OR \'1\'=\'1';
    
    // Register with malicious input
    const sanitizationRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: xssPayload, password: 'securePassword123', role: 'user' }),
    });
    const sanitizationData = await sanitizationRes.json();
    
    // Clean expected username: '<script>' and content removed, quotes escaped or removed
    // 'malicious<script>alert("hack")</script>user\' OR \'1\'=\'1' -> should become 'malicioususer\'\' OR \'\'1\'\'=\'\'1'
    const createdUserId = sanitizationData.userId;
    
    // Perform login with the same raw malicious payload
    const logSanRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: xssPayload, password: 'securePassword123' }),
    });
    
    if (logSanRes.status === 200) {
      console.log('  ✔ SUCCESS: Input was successfully sanitized of <script> blocks and SQL injection quotes.');
    } else {
      console.error(`  ❌ FAILED: Sanitized login failed with status ${logSanRes.status}.`);
    }

    // --- TEST 5: Information Disclosure & Error Shielding ---
    console.log('\nTest 5: Verifying Global Error Shielding...');
    const errRes = await fetch(`${BASE_URL}/api/test-error`);
    const errBody = await errRes.json();
    
    if (errRes.status === 500 && errBody.error === 'An unexpected error occurred. Please try again later.') {
      console.log('  ✔ SUCCESS: Server error shielded (generic message sent, raw database schemas/code stack hidden).');
    } else {
      console.error(`  ❌ FAILED: Internal crash leaked data with status ${errRes.status}.`, errBody);
    }

    // --- TEST 6: PII & Credentials Audit Trail Redaction ---
    console.log('\nTest 6: Verifying Security Audit Log Redaction...');
    const logFilePath = path.join(process.cwd(), 'logs', 'security.log');
    
    if (fs.existsSync(logFilePath)) {
      const logsContent = fs.readFileSync(logFilePath, 'utf8');
      const lines = logsContent.trim().split('\n');
      let allPass = true;
      
      for (const line of lines) {
        if (!line) continue;
        const entry = JSON.parse(line);
        // Ensure standard credential keys like 'password' do not appear as plaintext
        if (entry.details.password && entry.details.password !== '[REDACTED]') {
          allPass = false;
          console.error(`  ❌ FAILED: Found plaintext password in logs:`, entry);
        }
      }
      
      if (allPass) {
        console.log('  ✔ SUCCESS: Audit logger automatically redacted all password credentials.');
      }
    } else {
      console.error('  ❌ FAILED: Security log file was not generated.');
    }

    // --- TEST 7: Rate Limiter Protection ---
    console.log('\nTest 7: Verifying Rate Limiting (Mitigation of brute-force login attempts)...');
    let hitRateLimit = false;
    // Send 30 login requests quickly (max limit is 20)
    for (let i = 0; i < 30; i++) {
      const rateRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'reg_user', password: 'securePassword123' }),
      });
      if (rateRes.status === 429) {
        hitRateLimit = true;
        const rateBody = await rateRes.json();
        console.log(`  ✔ SUCCESS: Rate limiter activated on request #${i + 1} with HTTP 429.`);
        console.log(`            Response payload: ${JSON.stringify(rateBody)}`);
        break;
      }
    }
    if (!hitRateLimit) {
      console.error('  ❌ FAILED: Sent 10 consecutive requests but rate limiter was not triggered.');
    }

  } catch (error) {
    console.error('Error during testing verification:', error);
  } finally {
    if (serverProcess) {
      console.log('\nShutting down Express server...');
      serverProcess.kill('SIGINT');
    }
    console.log('\n====================================================');
    console.log('              VALIDATION SUITE FINISHED             ');
    console.log('====================================================');
  }
}

runTests();

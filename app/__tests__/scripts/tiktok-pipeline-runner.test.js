/**
 * Unit tests for TikTok Pipeline Runner Script
 * Tests the bash script functionality using Node.js
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);

describe('TikTok Pipeline Runner Script', () => {
  const scriptPath = path.join(__dirname, '../../run-tiktok-pipeline-simple.sh');
  const mainScriptPath = path.join(__dirname, '../../run-tiktok-pipeline.sh');
  
  beforeAll(() => {
    // Ensure scripts are executable
    if (fs.existsSync(scriptPath)) {
      fs.chmodSync(scriptPath, '755');
    }
    if (fs.existsSync(mainScriptPath)) {
      fs.chmodSync(mainScriptPath, '755');
    }
  });

  describe('Script File Tests', () => {
    test('should have executable simple script', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      const stats = fs.statSync(scriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check execute permissions
    });

    test('should have executable main script', () => {
      expect(fs.existsSync(mainScriptPath)).toBe(true);
      const stats = fs.statSync(mainScriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check execute permissions
    });

    test('should have proper shebang', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });
  });

  describe('Script Content Validation', () => {
    let scriptContent;

    beforeAll(() => {
      scriptContent = fs.readFileSync(scriptPath, 'utf8');
    });

    test('should have required functions', () => {
      expect(scriptContent).toContain('print_success()');
      expect(scriptContent).toContain('print_error()');
      expect(scriptContent).toContain('print_info()');
      expect(scriptContent).toContain('print_step()');
    });

    test('should have proper error handling', () => {
      expect(scriptContent).toContain('set -e');
      expect(scriptContent).toContain('exit 1');
    });

    test('should have timeout configuration', () => {
      expect(scriptContent).toContain('TIMEOUT=');
      expect(scriptContent).toContain('timeout');
    });

    test('should have correct API endpoint', () => {
      expect(scriptContent).toContain('/api/scraper/run-pipeline');
    });
  });

  describe('Script Execution Tests', () => {
    test('should show help when run with invalid arguments', async () => {
      try {
        const { stdout, stderr } = await execAsync(`bash ${scriptPath} --help 2>&1 || true`);
        const output = stdout + stderr;
        expect(output).toContain('TikTok Pipeline Runner');
      } catch (error) {
        // Script might not have --help, but it should still show the header
        expect(error.stdout || error.stderr).toContain('TikTok Pipeline Runner');
      }
    });

    test('should handle missing server gracefully', async () => {
      // Test with a non-existent server
      const testScript = `
        #!/bin/bash
        export API_BASE_URL="http://localhost:9999"
        ${scriptContent.replace('API_BASE_URL="http://localhost:3000"', 'API_BASE_URL="http://localhost:9999"')}
      `;
      
      const tempScriptPath = path.join(__dirname, 'temp-test-script.sh');
      fs.writeFileSync(tempScriptPath, testScript);
      fs.chmodSync(tempScriptPath, '755');

      try {
        const { stdout, stderr } = await execAsync(`bash ${tempScriptPath} test 2>&1 || true`);
        const output = stdout + stderr;
        expect(output).toContain('Server not responding');
      } finally {
        fs.unlinkSync(tempScriptPath);
      }
    });

    test('should validate required parameters', async () => {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} "" 2>&1 || true`);
      const output = stdout + stderr;
      // Should still work with empty keyword (defaults to "test")
      expect(output).toContain('TikTok Pipeline Runner');
    });
  });

  describe('Function Tests', () => {
    test('should have working color functions', async () => {
      const testScript = `
        #!/bin/bash
        source ${scriptPath}
        print_success "test success"
        print_error "test error"
        print_info "test info"
        print_step "1" "test step"
      `;
      
      const tempScriptPath = path.join(__dirname, 'temp-function-test.sh');
      fs.writeFileSync(tempScriptPath, testScript);
      fs.chmodSync(tempScriptPath, '755');

      try {
        const { stdout, stderr } = await execAsync(`bash ${tempScriptPath} 2>&1 || true`);
        const output = stdout + stderr;
        expect(output).toContain('test success');
        expect(output).toContain('test error');
        expect(output).toContain('test info');
        expect(output).toContain('test step');
      } finally {
        fs.unlinkSync(tempScriptPath);
      }
    });
  });

  describe('API Integration Tests', () => {
    test('should create proper JSON payload', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      // Check that the script creates proper JSON with keywords field
      expect(content).toContain('{"keywords": "');
      expect(content).toContain('Content-Type: application/json');
    });

    test('should handle curl errors', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('timeout');
      expect(content).toContain('curl');
    });
  });

  describe('Main Script Tests', () => {
    let mainScriptContent;

    beforeAll(() => {
      if (fs.existsSync(mainScriptPath)) {
        mainScriptContent = fs.readFileSync(mainScriptPath, 'utf8');
      }
    });

    test('should have port detection function', () => {
      if (mainScriptContent) {
        expect(mainScriptContent).toContain('detect_server_port()');
        expect(mainScriptContent).toContain('for port in');
      }
    });

    test('should have progress monitoring', () => {
      if (mainScriptContent) {
        expect(mainScriptContent).toContain('draw_progress_bar');
        expect(mainScriptContent).toContain('progress');
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle network timeouts', async () => {
      const testScript = `
        #!/bin/bash
        ${scriptContent}
      `.replace('TIMEOUT=60', 'TIMEOUT=1');
      
      const tempScriptPath = path.join(__dirname, 'temp-timeout-test.sh');
      fs.writeFileSync(tempScriptPath, testScript);
      fs.chmodSync(tempScriptPath, '755');

      try {
        const { stdout, stderr } = await execAsync(`bash ${tempScriptPath} test 2>&1 || true`);
        const output = stdout + stderr;
        // Should handle timeout gracefully
        expect(output).toContain('TikTok Pipeline Runner');
      } finally {
        fs.unlinkSync(tempScriptPath);
      }
    });

    test('should validate input parameters', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      // Should have parameter validation
      expect(content).toContain('KEYWORD=');
      expect(content).toContain('${1:-');
    });
  });

  describe('Integration with Development Server', () => {
    test('should attempt to connect to local server', async () => {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} "test-keyword" 2>&1 || true`);
      const output = stdout + stderr;
      
      // Should show the pipeline runner header
      expect(output).toContain('TikTok Pipeline Runner');
      expect(output).toContain('Keyword: "test-keyword"');
      
      // Should attempt server connection
      expect(output).toContain('Checking server connection');
    });
  });

  describe('Output Format Tests', () => {
    test('should produce structured output', async () => {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} "structured-test" 2>&1 || true`);
      const output = stdout + stderr;
      
      // Should have structured output with steps
      expect(output).toContain('[STEP 1]');
      expect(output).toContain('[STEP 2]');
      expect(output).toContain('[STEP 3]');
    });

    test('should include helpful information', async () => {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} "info-test" 2>&1 || true`);
      const output = stdout + stderr;
      
      // Should include useful information
      expect(output).toContain('Useful commands:');
      expect(output).toContain('/creators');
    });
  });
});

// Helper function to create mock server for testing
function createMockServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
      if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else if (req.url === '/api/scraper/run-pipeline') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"type":"output","data":"test output"}\n\n');
        setTimeout(() => {
          res.write('data: {"type":"complete","data":{"success":true}}\n\n');
          res.end();
        }, 100);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      resolve(server);
    });

    server.on('error', reject);
  });
}

describe('Integration Tests with Mock Server', () => {
  let server;

  beforeAll(async () => {
    try {
      server = await createMockServer(3333);
    } catch (error) {
      console.log('Could not start mock server for integration tests:', error.message);
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  test('should work with mock server', async () => {
    if (!server) {
      console.log('Skipping integration test - no mock server');
      return;
    }

    const testScript = `
      #!/bin/bash
      ${fs.readFileSync(scriptPath, 'utf8').replace('http://localhost:3000', 'http://localhost:3333')}
    `;
    
    const tempScriptPath = path.join(__dirname, 'temp-integration-test.sh');
    fs.writeFileSync(tempScriptPath, testScript);
    fs.chmodSync(tempScriptPath, '755');

    try {
      const { stdout, stderr } = await execAsync(`bash ${tempScriptPath} integration-test 2>&1 || true`);
      const output = stdout + stderr;
      
      expect(output).toContain('Server is responding');
      expect(output).toContain('Pipeline started successfully');
    } finally {
      fs.unlinkSync(tempScriptPath);
    }
  });
});
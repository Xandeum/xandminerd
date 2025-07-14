const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io'); // Add Socket.IO
const { Keypair } = require('@solana/web3.js');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const util = require('util');
const { spawn, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { getDiskSpaceInfo, testNetworkSpeed, getServerInfo, dedicateSpace, getVersions } = require('./helpers');
const { registerPNode, readPnode } = require('./transactions');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(cors());

const PORT = 4000;
const HOST = '127.0.0.1';

app.post('/drives', (req, res) => {
  getDiskSpaceInfo()
    .then((data) => {
      res.status(200).json({ data: { drives: data } });
    })
    .catch((err) => {
      res.status(500).json({ err });
    });
});

app.post('/drive/dedicate', (req, res) => {
  const { space, path } = req?.body;
  dedicateSpace(space, path)
    .then((data) => {
      if (data?.ok) {
        res.status(200).json({ data });
        return;
      }
      res.status(500).json({ ok: false, error: 'Internal server error' });
    })
    .catch((err) => {
      res.status(500).json({ err });
    });
});

app.get('/network', (req, res) => {
  testNetworkSpeed()
    .then((data) => {
      res.status(200).json(data);
    })
    .catch((err) => {
      console.error('Error testing network speed:', err);
      res.status(500).json({ err });
    });
});

app.post('/keypair/generate', (req, res) => {
  try {
    const KEYPAIR_DIR = './keypairs';
    const KEYPAIR_FILE_NAME = 'pnode-keypair.json';
    if (!fs.existsSync(KEYPAIR_DIR)) {
      fs.mkdirSync(KEYPAIR_DIR, { recursive: true });
    }
    const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Keypair file already exists.' });
    }
    const keypair = Keypair.generate();
    const keypairJson = {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: Array.from(keypair.secretKey),
    };
    fs.writeFileSync(filePath, JSON.stringify(keypairJson, null, 2));
    res.status(200).json({
      message: 'Keypair generated and saved successfully.',
      publicKey: keypairJson.publicKey,
    });
  } catch (error) {
    console.error('Error generating keypair:', error.message);
    res.status(500).json({ error: 'Failed to generate keypair.' });
  }
});

app.get('/keypair', (req, res) => {
  try {
    const filePath = path.join('./keypairs', 'pnode-keypair.json');
    if (!fssync.existsSync(filePath)) {
      return res.status(404).json({ error: 'Keypair file does not exist.' });
    }
    const keypairJson = JSON.parse(fssync.readFileSync(filePath, 'utf-8'));
    res.status(200).json({
      message: 'Public key retrieved successfully.',
      publicKey: keypairJson.publicKey,
    });
  } catch (error) {
    console.error('Error retrieving public key:', error.message);
    res.status(500).json({ error: 'Failed to retrieve public key.' });
  }
});

app.post('/pnode', (req, res) => {
  const { pubKey } = req?.body;
  registerPNode(pubKey)
    .then((data) => {
      if (data?.error) {
        throw new Error(data.error);
      }
      res.status(200).json({ ok: true, tx: data?.tx });
    })
    .catch((err) => {
      res.status(500).json({ message: err?.message });
    });
});

app.get('/pnode', (req, res) => {
  readPnode()
    .then((data) => {
      if (data?.error) {
        res.status(500).json({ ok: false, err: data?.error });
      } else if (!data?.ok) {
        res.status(404).json({ ok: false, isRegistered: false });
      } else {
        res.status(200).json({ ok: true, data });
      }
    })
    .catch((err) => {
      res.status(500).json({ err });
    });
});

app.get('/server-ip', (req, res) => {
  getServerInfo()
    .then((data) => {
      if (!data?.ok) {
        res.status(500).json({ ok: false });
      }
      res.status(200).json({ ok: true, ...data });
    });
});

// API endpoint to read versions
app.get('/versions', (req, res) => {
  getVersions()
    .then((data) => {
      if (data?.ok) {
        res.status(200).json({ ok: true, data });
      } else {
        res.status(500).json({ ok: false, error: data?.error });
      }
    })
    .catch((err) => {
      console.error('Error retrieving versions:', err);
      res.status(500).json({ ok: false, error: err.message });
    });
});

app.post('/pods/install', (req, res) => {
  const sessionId = uuidv4();
  res.status(200).json({ sessionId, message: 'Command execution started' });
});

// Command sequence
const execPromise = util.promisify(exec);

// Track active processes by sessionId
const activeProcesses = new Map();

// Command definitions for pod installation
const podInstallCommands = [
  {
    command: 'apt-get',
    args: ['install', '-y', 'apt-transport-https', 'ca-certificates', 'curl', 'gnupg'],
    sudo: true,
    description: 'Install required packages for pod',
  },
  {
    command: 'tee',
    args: ['/etc/apt/sources.list.d/xandeum-pod.list'],
    input: 'deb [trusted=yes] https://xandeum.github.io/pod-apt-package/ stable main',
    sudo: true,
    description: 'Add Xandeum pod repository',
  },
  {
    command: 'bash',
    args: ['-c', 'curl -s https://xandeum.github.io/pod-apt-package/gpgkey | gpg --dearmor | tee /etc/apt/trusted.gpg.d/xandeum-pod.gpg >/dev/null'],
    sudo: true,
    description: 'Import Xandeum GPG key',
    allowFailure: true,
  },
  {
    command: 'bash',
    args: ['-c', 'grep -v "packagecloud\\.io/ookla/speedtest-cli" /etc/apt/sources.list > /tmp/sources.list && mv /tmp/sources.list /etc/apt/sources.list || true'],
    sudo: true,
    description: 'Remove packagecloud.io/ookla/speedtest-cli from sources.list',
    allowFailure: true,
  },
  {
    command: 'bash',
    args: ['-c', 'rm -f /etc/apt/sources.list.d/ookla_speedtest-cli.list || true'],
    sudo: true,
    description: 'Remove packagecloud.io/ookla/speedtest-cli from sources.list.d',
    allowFailure: true,
  },
  {
    command: 'apt-get',
    args: ['update'],
    sudo: true,
    description: 'Update package lists',
    allowFailure: true,
  },
  {
    command: 'apt-get',
    args: ['install', '-y', '--allow-unauthenticated', 'pod'],
    sudo: true,
    description: 'Install pod package',
    allowFailure: true,
  },
  {
    command: 'tee',
    args: ['/etc/systemd/system/pod.service'],
    input: `
[Unit]
Description=Xandeum Pod System service
After=network.target

[Service]
ExecStart=/usr/bin/pod
Restart=always
User=root
Environment=NODE_ENV=production
Environment=RUST_LOG=info
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=xandeum-pod

[Install]
WantedBy=multi-user.target
`,
    sudo: true,
    description: 'Create pod.service file',
  },
  {
    command: 'systemctl',
    args: ['daemon-reload'],
    sudo: true,
    description: 'Reload systemd configuration for pod',
  },
  {
    command: 'systemctl',
    args: ['enable', 'pod.service'],
    sudo: true,
    description: 'Enable pod.service',
  },
  {
    command: 'systemctl',
    args: ['start', 'pod.service'],
    sudo: true,
    description: 'Start pod.service',
  },
];

// Function to ensure a script is executable
async function ensureExecutable(scriptPath, socket, sessionId) {
  try {
    // Check if the script exists
    await fs.access(scriptPath, fs.constants.R_OK); // Verify read access
    socket.emit('command-output', {
      sessionId,
      type: 'stdout',
      data: `Script ${scriptPath} found, setting executable permissions...\n`,
    });

    // Set executable permissions
    await fs.chmod(scriptPath, '755');
    socket.emit('command-output', {
      sessionId,
      type: 'stdout',
      data: `Set executable permissions for ${scriptPath}\n`,
    });
  } catch (error) {
    const errorMessage = error.code === 'ENOENT'
      ? `Script ${scriptPath} not found`
      : `Failed to set permissions for ${scriptPath}: ${error.message}`;
    socket.emit('command-output', {
      sessionId,
      type: 'error',
      data: errorMessage,
      status: 'error',
    });
    throw new Error(errorMessage);
  }
}

// Function to execute a single command and stream output via Socket.IO
async function executeCommand(socket, sessionId, { command, args, input, sudo, cwd, description, allowFailure = false }) {
  return new Promise((resolve, reject) => {
    const fullCommand = sudo ? ['sudo', command, ...args] : [command, ...args];
    const child = spawn(fullCommand[0], fullCommand.slice(1), { cwd, shell: command === 'bash' });

    activeProcesses.set(sessionId, child);

    socket.emit('command-output', {
      sessionId,
      type: 'stdout',
      data: `Running: ${description} (${sudo ? 'sudo ' : ''}${command} ${args.join(' ')})\n`,
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
      socket.emit('command-output', { sessionId, type: 'stdout', data: data.toString() });
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
      socket.emit('command-output', { sessionId, type: 'stderr', data: data.toString() });
    });

    child.on('error', (error) => {
      activeProcesses.delete(sessionId);
      socket.emit('command-output', {
        sessionId,
        type: 'error',
        data: `Error: ${description} failed: ${error.message}`,
        status: 'error',
      });
      if (allowFailure) {
        resolve(output); // Continue even if this command fails
      } else {
        reject(error);
      }
    });

    child.on('close', (code) => {
      activeProcesses.delete(sessionId);
      if (code !== 0 && !allowFailure) {
        socket.emit('command-output', {
          sessionId,
          type: 'error',
          data: `Error: ${description} failed with code ${code}`,
          status: 'error',
        });
        reject(new Error(`Command failed with code ${code}`));
      } else {
        socket.emit('command-output', {
          sessionId,
          type: 'stdout',
          data: `${description} completed successfully.\n`,
        });
        resolve(output);
      }
    });
  });
}

// Function to run a sequence of commands
async function runCommandSequence(socket, sessionId, commands) {
  for (let i = 0; i < commands.length; i++) {
    try {
      await executeCommand(socket, sessionId, commands[i]);
    } catch (error) {
      if (commands[i].allowFailure) {
        socket.emit('command-output', {
          sessionId,
          type: 'stdout',
          data: `Continuing despite error in: ${commands[i].description}\n`,
        });
        continue;
      }
      return; // Stop on non-allowable failure
    }
  }
}

// Function to perform upgrade (xandminerd, pod, xandminer)
async function performUpgrade(socket, sessionId) {
  try {
    // Step 1: Upgrade xandminerd
    socket.emit('command-output', { sessionId, type: 'stdout', data: 'Upgrading xandminerd...\n' });
    const xandminerdScript = '/root/xandminerd/src/scripts/upgrade-xandminerd.sh';
    await ensureExecutable(xandminerdScript, socket, sessionId);
    await execPromise(`bash ${xandminerdScript}`);
    socket.emit('command-output', { sessionId, type: 'stdout', data: 'xandminerd upgrade completed successfully.\n' });

    // Step 2: Install/upgrade pod
    socket.emit('command-output', { sessionId, type: 'stdout', data: 'Installing/upgrading pod...\n' });
    await runCommandSequence(socket, sessionId, podInstallCommands);
    socket.emit('command-output', { sessionId, type: 'stdout', data: 'Pod installation/upgrade completed successfully.\n' });

    // Step 3: Upgrade xandminer
    socket.emit('command-output', { sessionId, type: 'stdout', data: 'Upgrading xandminer...\n' });
    const xandminerScript = '/root/xandminerd/src/scripts/upgrade-xandminer.sh';
    await ensureExecutable(xandminerScript, socket, sessionId);
    await execPromise(`bash ${xandminerScript}`);

    // Step 4: Send completion message (before restarting services)
    socket.emit('command-output', {
      sessionId,
      type: 'complete',
      data: 'Upgrade completed successfully.',
      status: 'success',
    });

    // Step 5: Restart xandminerd and pod (deferred)
    exec('systemctl daemon-reload && systemctl restart xandminerd.service && systemctl restart pod.service', (error) => {
      if (error) {
        console.error('Service restart failed:', error);
      } else {
        console.log('xandminerd and pod restarted successfully');
        // socket.emit('command-output', {
        //   sessionId,
        //   type: 'stdout',
        //   data: 'xandminerd and pod restarted successfully.\n',
        // });
      }
    });
  } catch (error) {
    socket.emit('command-output', {
      sessionId,
      type: 'error',
      data: `Upgrade failed: ${error.message}`,
      status: 'error',
    });
  }
}

// API endpoint for upgrade
app.post('/api/upgrade', (req, res) => {
  const sessionId = uuidv4();
  res.status(200).json({ sessionId, message: 'Upgrade process started' });

  // Find the socket for this session
  io.sockets.sockets.forEach((socket) => {
    if (socket.sessionId === sessionId) {
      performUpgrade(socket, sessionId);
    }
  });
});

// API endpoint to restart xandminer
app.post('/api/restart-xandminer', async (req, res) => {
  try {
    await execPromise('systemctl daemon-reload && systemctl restart xandminer.service');
    res.status(200).json({ message: 'Xandminer restart initiated' });
  } catch (error) {
    console.error('Restart failed:', error);
    res.status(500).json({ error: 'Restart failed', details: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.on('start-command', (data) => {
    const { sessionId } = data;
    socket.sessionId = sessionId; // Store sessionId on socket
    performUpgrade(socket, sessionId);
  });

  socket.on('cancel-command', (data) => {
    const { sessionId } = data;
    const child = activeProcesses.get(sessionId);
    if (child) {
      child.kill('SIGINT');
      socket.emit('command-output', {
        sessionId,
        type: 'complete',
        data: 'Upgrade sequence cancelled by user.',
        status: 'cancelled',
      });
      activeProcesses.delete(sessionId);
      socket.disconnect();
    } else {
      socket.emit('command-output', {
        sessionId,
        type: 'error',
        data: 'No active command to cancel.',
      });
    }
  });

  socket.on('disconnect', () => {
    const sessionId = [...activeProcesses.keys()].find((id) => {
      const child = activeProcesses.get(id);
      return child.socketId === socket.id;
    });
    if (sessionId) {
      const child = activeProcesses.get(sessionId);
      child.kill('SIGINT');
      activeProcesses.delete(sessionId);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`xandminerD running at http://${HOST}:${PORT}`);
});

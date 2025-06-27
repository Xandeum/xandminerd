const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io'); // Add Socket.IO
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { getDiskSpaceInfo, testNetworkSpeed, getServerInfo, dedicateSpace } = require('./helpers');
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
      res.status(200).json({ data: JSON.parse(data) });
    })
    .catch((err) => {
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
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Keypair file does not exist.' });
    }
    const keypairJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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
app.post('/pods/install', (req, res) => {
  const sessionId = uuidv4();
  res.status(200).json({ sessionId, message: 'Command execution started' });
});

// Command sequence
const commands = [
  {
    command: 'apt-get',
    args: ['install', '-y', 'apt-transport-https', 'ca-certificates'],
    sudo: true,
  },
  {
    command: 'tee',
    args: ['/etc/apt/sources.list.d/xandeum-pod.list'],
    input: 'deb [trusted=yes] https://xandeum.github.io/pod-apt-package/ stable main',
    sudo: true,
  },
  {
    command: 'apt-get',
    args: ['update'],
    sudo: true,
  },
  {
    command: 'apt-get',
    args: ['install', '-y', 'pod'],
    sudo: true,
  },
  {
    command: 'bash',
    args: ['-c', `
      SERVICE_FILE="/etc/systemd/system/pod.service"
      echo "🛠️ Writing $SERVICE_FILE..."
      sudo tee "$SERVICE_FILE" > /dev/null <<EOF
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
EOF
      echo "Reloading systemd..."
      sudo systemctl daemon-reload
      echo "Enabling pod.service..."
      sudo systemctl enable pod.service
      echo "Starting pod.service..."
      sudo systemctl start pod.service
      echo "pod.service is now running. Check status with:"
      echo "sudo systemctl status pod.service"
    `],
    sudo: false,
    cwd: process.cwd(),
  },
];

// Track active processes by sessionId
const activeProcesses = new Map();

const runCommandSequence = (socket, sessionId) => {
  let index = 0;

  const runNextCommand = () => {
    if (index >= commands.length) {
      socket.emit('command-output', {
        sessionId,
        type: 'complete',
        data: 'All commands completed successfully.',
        status: 'success',
      });
      activeProcesses.delete(sessionId);
      socket.disconnect();
      return;
    }

    const { command, args, input, sudo, cwd } = commands[index];
    const fullCommand = sudo ? ['sudo', command, ...args] : [command, ...args];
    const child = spawn(fullCommand[0], fullCommand.slice(1), { cwd });

    // Store child process
    activeProcesses.set(sessionId, child);

    // If command requires input
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    socket.emit('command-output', {
      sessionId,
      type: 'stdout',
      data: `Running: ${sudo ? 'sudo ' : ''}${command} ${args.join(' ')}\n`,
    });

    child.stdout.on('data', (data) => {
      socket.emit('command-output', { sessionId, type: 'stdout', data: data.toString() });
    });

    child.stderr.on('data', (data) => {
      socket.emit('command-output', { sessionId, type: 'stderr', data: data.toString() });
    });

    child.on('error', (error) => {
      socket.emit('command-output', {
        sessionId,
        type: 'error',
        data: `Step ${index + 1} failed: ${error.message}`,
        status: 'error',
      });
      activeProcesses.delete(sessionId);
      socket.disconnect();
    });

    child.on('close', (code) => {
      activeProcesses.delete(sessionId);
      if (code !== 0) {
        socket.emit('command-output', {
          sessionId,
          type: 'error',
          data: `Step ${index + 1} failed: Command exited with code ${code}`,
          status: 'error',
        });
        socket.disconnect();
        return;
      }
      socket.emit('command-output', {
        sessionId,
        type: 'stdout',
        data: `Step ${index + 1} completed successfully.\n`,
      });
      index++;
      runNextCommand();
    });
  };

  runNextCommand();
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('start-command', (data) => {
    const { sessionId } = data;
    console.log(`Starting command sequence for session: ${sessionId}`);
    runCommandSequence(socket, sessionId);
  });

  socket.on('cancel-command', (data) => {
    const { sessionId } = data;
    console.log(`Received cancel request for session: ${sessionId}`);
    const child = activeProcesses.get(sessionId);
    if (child) {
      child.kill('SIGINT');
      socket.emit('command-output', {
        sessionId,
        type: 'complete',
        data: 'Command sequence cancelled by user.',
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
    console.log('Client disconnected:', socket.id);
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
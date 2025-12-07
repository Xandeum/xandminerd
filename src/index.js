const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
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

// --- AUTHENTICATION SETUP ---
const AUTH_FILE = path.join(__dirname, '../auth.json');
let API_KEY;

function loadOrGenerateApiKey() {
  try {
    if (fssync.existsSync(AUTH_FILE)) {
      const data = JSON.parse(fssync.readFileSync(AUTH_FILE, 'utf-8'));
      if (data.apiKey) {
        API_KEY = data.apiKey;
        console.log('Loaded API Key from auth.json');
      }
    }
  } catch (err) {
    console.error('Error loading auth file:', err.message);
  }

  if (!API_KEY) {
    API_KEY = uuidv4();
    try {
      fssync.writeFileSync(AUTH_FILE, JSON.stringify({ apiKey: API_KEY }, null, 2));
      console.log('Generated new API Key and saved to auth.json');
    } catch (err) {
      console.error('CRITICAL: Failed to save API Key to auth.json:', err.message);
    }
  }
  
  // Print key to console on startup for user visibility
  console.log('---------------------------------------------------');
  console.log(`SECURE API KEY: ${API_KEY}`);
  console.log('Use this key in the "x-api-key" header for requests.');
  console.log('---------------------------------------------------');
}

loadOrGenerateApiKey();
// ----------------------------

// --- CORS CONFIGURATION ---
const ALLOWED_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const corsOptions = {
  origin: ALLOWED_ORIGIN_REGEX,
  methods: ['GET', 'POST'],
  allowedHeaders: ['content-type', 'x-api-key'],
  credentials: true
};
// --------------------------

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// --- SOCKET.IO AUTHENTICATION ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-api-key'];
  if (token === API_KEY) {
    next();
  } else {
    const err = new Error("not authorized");
    err.data = { content: "Please retry with a valid API key" }; 
    next(err);
  }
});
// --------------------------------

app.use(express.json());
app.use(cors(corsOptions));

// --- EXPRESS AUTHENTICATION MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
  const clientKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!clientKey || clientKey !== API_KEY) {
    return res.status(401).json({ 
      ok: false, 
      error: 'Unauthorized. Please provide a valid "x-api-key" header.' 
    });
  }
  next();
};

app.use(authMiddleware);
// -----------------------------------------

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
    if (!fssync.existsSync(KEYPAIR_DIR)) {
      fssync.mkdirSync(KEYPAIR_DIR, { recursive: true });
    }
    const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
    if (fssync.existsSync(filePath)) {
      return res.status(400).json({ error: 'Keypair file already exists.' });
    }
    const keypair = Keypair.generate();
    const keypairJson = {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: Array.from(keypair.secretKey),
    };
    fssync.writeFileSync(filePath, JSON.stringify(keypairJson, null, 2));
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
      } else if (!
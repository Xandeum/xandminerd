const express = require('express');
const { Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const { createHandler } = require('graphql-http/lib/use/express');
const schema = require('./schema');
const { getDiskSpaceInfo, testNetworkSpeed } = require('./helpers');


let cors = require('cors');
const app = express();
app.use(cors())
const port = 4000;

// app.post('/drives', createHandler({ schema }));
app.post('/drives', (req, res) => {
  getDiskSpaceInfo().then((data) => {
    // console.log("res >>> ", data)
    res.status(200);
    res.send({ data: { drives: data } });
  });
});

app.get('/network', (req, res) => {
  testNetworkSpeed().then((data) => {
    console.log("network speed >>> ", data);
    res.status(200);
    res.send({ data: JSON.parse(data) });
  }).catch((err) => {
    res.status(500);
    res.send({ err });
  });
});

// Directory where the keypair file will be saved
const KEYPAIR_DIR = "./keypairs";
const KEYPAIR_FILE_NAME = "pnode-keypair.json";

// Ensure the directory exists
function ensureDirectoryExists() {
  if (!fs.existsSync(KEYPAIR_DIR)) {
    fs.mkdirSync(KEYPAIR_DIR, { recursive: true });
  }
}

app.post('/keypair/generate', (req, res) => {
  try {
    // Ensure the directory exists
    ensureDirectoryExists();

    const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: "Keypair file already exist." });
    }

    // Generate a new keypair
    const keypair = Keypair.generate();

    // Convert the keypair to a JSON object
    const keypairJson = {
      publicKey: keypair.publicKey.toBase58(), // Public key as base58 string
      privateKey: Array.from(keypair.secretKey), // Private key as an array of numbers
    };

    // Save the keypair to a file
    fs.writeFileSync(filePath, JSON.stringify(keypairJson, null, 2));

    console.log(`Keypair saved to ${filePath}`);

    // Respond with the public key
    res.status(200).json({
      message: "Keypair generated and saved successfully.",
      publicKey: keypairJson.publicKey,
    });
  } catch (error) {
    console.error("Error generating keypair:", error.message);
    res.status(500).json({ error: "Failed to generate keypair." });
  }
});

// Check if the keypair file exists and return the public key
app.get("/keypair", (req, res) => {
  try {
    const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Keypair file does not exist." });
    }

    // Read the keypair file
    const keypairJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Extract and return the public key
    const publicKey = keypairJson.publicKey;
    res.status(200).json({
      message: "Public key retrieved successfully.",
      publicKey: publicKey,
    });
  } catch (error) {
    console.error("Error retrieving public key:", error.message);
    res.status(500).json({ error: "Failed to retrieve public key." });
  }
});

app.listen({ port: 4000 });
console.log(`Listening to port ${port}`);
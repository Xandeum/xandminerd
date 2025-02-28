const { PublicKey, Connection, Keypair, TransactionInstruction, Transaction } = require("@solana/web3.js");
const path = require("path");
const fs = require("fs");


const registerPNode = async (walletPubKey) => {

    const KEYPAIR_DIR = "./keypairs";
    const KEYPAIR_FILE_NAME = "pnode-keypair.json";
    const DEVNET_PROGRAM = new PublicKey("2YCmooMUuhAZRcxKVA62zc9A2NiWfqbCnJbm53UT4aic");

    // const owner = new PublicKey(walletPubKey)
    let pk = new PublicKey("9eVnceJcJFmdPiyNgFx1gQcqkLego5J4Pkmgoog4BDoU")

    try {
        const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
        const keypairJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairJson.privateKey));

        const connection = new Connection("https://api.devnet.xandeum.com:8899", "confirmed");

        await connection.requestAirdrop(wallet.publicKey, 1000000000);

        let registry = PublicKey.findProgramAddressSync(
            [Buffer.from("registryV1"), wallet?.publicKey?.toBuffer()],
            DEVNET_PROGRAM
        )[0];

        let global = PublicKey.findProgramAddressSync(
            [Buffer.from("global")],
            PROGRAM
        )[0];

        let manager = PublicKey.findProgramAddressSync(
            [Buffer.from("manager"), pk.toBuffer()],
            PROGRAM
        )[0];

        const keys = [
            {
                pubkey: wallet?.publicKey,
                isSigner: true,
                isWritable: true,
            },
            {
                pubkey: registry,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: pk,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: global,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: manager,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: new PublicKey("11111111111111111111111111111111"),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"),
                isSigner: false,
                isWritable: false,
            },
        ];

        const data = Buffer.from(Int8Array.from([0]).buffer);
        const txIx = new TransactionInstruction({
            keys: keys,
            programId: DEVNET_PROGRAM,
            data: data,
        });

        const transaction = new Transaction().add(txIx)

        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight }
        } = await connection.getLatestBlockhashAndContext('confirmed');

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transaction.sign(wallet);

        const sign = await connection.sendRawTransaction(transaction.serialize());

        //wait for 3 seconds
        await new Promise((resolve) => setTimeout(resolve
            , 3000));

        const confirmTx = await connection?.getSignatureStatuses([sign], { searchTransactionHistory: true });

        // Check if the transaction has a status
        const status = confirmTx?.value[0];
        if (!status) {
            return { error: "Transaction not found" };
        }

        // Check if the transaction failed
        if (status?.err) {
            return { error: status.err };
        }

        return { success: "Transaction successful", tx: sign };
    } catch (error) {
        return { error: error.message };
    }
}

const readPnode = async () => {
    const KEYPAIR_DIR = "./keypairs";
    const KEYPAIR_FILE_NAME = "pnode-keypair.json";
    const DEVNET_PROGRAM = new PublicKey("2YCmooMUuhAZRcxKVA62zc9A2NiWfqbCnJbm53UT4aic");

    try {
        const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
        const keypairJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairJson.privateKey));

        const connection = new Connection("https://api.devnet.xandeum.com:8899", "confirmed");

        return { ok: true, publicKey: wallet.publicKey.toBase58() };

    } catch (error) {
        return { error: error.message };
    }
}

module.exports = { registerPNode, readPnode };
const { PublicKey, Connection, Keypair, TransactionInstruction, Transaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const path = require("path");
const fs = require("fs");


const registerPNode = async (walletPubKey) => {

    const KEYPAIR_DIR = "./keypairs";
    const KEYPAIR_FILE_NAME = "pnode-keypair.json";
    const DEVNET_PROGRAM = new PublicKey("2YCmooMUuhAZRcxKVA62zc9A2NiWfqbCnJbm53UT4aic");

    const owner = new PublicKey(walletPubKey)
    // let pk = new PublicKey("9eVnceJcJFmdPiyNgFx1gQcqkLego5J4Pkmgoog4BDoU")

    try {
        const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
        const keypairJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairJson.privateKey));

        const connection = new Connection("https://api.devnet.xandeum.com:8899", "confirmed");

        let balance = await connection.getBalance(
            wallet?.publicKey,
            'confirmed'
        );
        balance = balance / LAMPORTS_PER_SOL;

        console.log("balance >>> ", balance);

        if (!balance || balance == 0 || balance == null) {
            await connection.requestAirdrop(wallet.publicKey, 1000000000);
        }

        await new Promise((resolve) => setTimeout(resolve
            , 3000));

        let registry = PublicKey.findProgramAddressSync(
            [Buffer.from("registryV1"), wallet?.publicKey?.toBuffer()],
            DEVNET_PROGRAM
        )[0];

        let global = PublicKey.findProgramAddressSync(
            [Buffer.from("global")],
            DEVNET_PROGRAM
        )[0];

        let manager = PublicKey.findProgramAddressSync(
            [Buffer.from("manager"), owner.toBuffer()],
            DEVNET_PROGRAM
        )[0];

        let index = new PublicKey("JAMRrRGg5YRhsjHckaWSnYryLqSRpc8oYwgUnA1GStYc"); // pNode list account

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
                pubkey: owner,
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
                pubkey: index,
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

        let indexData = await connection.getParsedAccountInfo(index);

        let pnodes = []

        for (let i = 0; i < indexData.value.data.length; i += 32) {
            const pubkeyBytes = indexData.value.data.slice(i, i + 32);
            const pubkey = new PublicKey(pubkeyBytes);
            pnodes.push(pubkey)
        }

        for (let j = 0; j < pnodes.length; j++) {
            if (pnodes[j].toBase58() == PublicKey.default.toBase58()) {
                index = j;
                break
            }
        }

        // const data = Buffer.from(Int8Array.from([0]).buffer);
        const data = Buffer.concat([Buffer.from(Int8Array.from([0]).buffer), numToUint8Array(index)]);

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
        console.log("error while register >>> ", error);
        if (error?.message.includes("already in use")) {
            return { error: "Account is already in use" };
        }
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

        let managerPda = PublicKey.findProgramAddressSync(
            [Buffer.from("manager"), wallet?.publicKey.toBuffer()],
            DEVNET_PROGRAM
        );

        let dat = await connection.getParsedAccountInfo(managerPda[0]);

        if (dat.value == null) {
            return { ok: false, isRegistered: true };

        }

        return { ok: true, isRegistered: true };

    } catch (error) {
        return { error: error.message };
    }
}

module.exports = { registerPNode, readPnode };

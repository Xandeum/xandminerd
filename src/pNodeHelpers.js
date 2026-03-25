import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import path from "path";
import fs from "fs";

const PROGRAM = new PublicKey("CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL");

function arrayToNum8(array) {
    const arr = new Uint8Array(array);
    const view = new DataView(arr.buffer || arr);
    const num = view.getUint8(0);
    return num.toString();
}

function deserializePNodeOwner(data) {
    return {
        user: new PublicKey(data.slice(0, 32)),
        pnode: arrayToNum8(data.slice(32, 33)),
        pnode_with_coupon: arrayToNum8(data.slice(33, 34))
    };
}

async function fetchPNodeOwnerData(connection, walletPubkey) {
    const [pnodeOwnerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pnodeowner"), walletPubkey.toBuffer()],
        PROGRAM
    );

    const accountInfo = await connection.getParsedAccountInfo(pnodeOwnerPda);
    if (!accountInfo.value) {
        return null;
    }

    return deserializePNodeOwner(accountInfo.value.data);
}

function derivePnodeAccountPda(ownerPubkey, index) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("pnode_account"),
            ownerPubkey.toBuffer(),
            Buffer.from([index]),
        ],
        PROGRAM
    );
    return [pda, bump];
}

async function readPnodeInfoArray(connection, ownerPubkey, pNodesQty) {
    const pnodeInfos = [];

    for (let i = 0; i < pNodesQty; i++) {
        const [pnodeAccountPda] = derivePnodeAccountPda(ownerPubkey, i);

        const accountInfo = await connection.getAccountInfo(pnodeAccountPda);

        if (!accountInfo || !accountInfo.data) {
            // return null;
            pnodeInfos.push({
                owner: ownerPubkey,
                index: i,
                devnet_pnode: PublicKey.default,
                mainnet_pnode: PublicKey.default,
                nft_slot_1: PublicKey.default,
                nft_slot_2: PublicKey.default,
                manager: PublicKey.default,
                registration_time: 0,
                manager_commission: 0,
            })
            continue;
        }

        const data = accountInfo?.data;
        let offset = 0;

        const pnodeAccount = {
            owner: new PublicKey(data.slice(offset, offset + 32)),
            index: data[offset + 32],
            devnet_pnode: new PublicKey(data.slice(offset + 33, offset + 65)),
            mainnet_pnode: new PublicKey(data.slice(offset + 65, offset + 97)),
            nft_slot_1: new PublicKey(data.slice(offset + 97, offset + 129)),
            nft_slot_2: new PublicKey(data.slice(offset + 129, offset + 161)),
            manager: new PublicKey(data.slice(offset + 161, offset + 193)),
            registration_time: Number(data.readBigInt64LE(offset + 193)),
            manager_commission: data.readUInt32LE(offset + 201),
        };
        pnodeInfos.push(pnodeAccount);
    }

    return pnodeInfos;
}

const readPnode = async (pubkey) => {
    const KEYPAIR_DIR = "./keypairs";
    const KEYPAIR_FILE_NAME = "pnode-keypair.json";

    try {
        const filePath = path.join(KEYPAIR_DIR, KEYPAIR_FILE_NAME);
        const keypairJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairJson.privateKey));
        const connection = new Connection("https://solana-rpc.publicnode.com");
        const ownerPubkey = new PublicKey(pubkey);
        const pNodeOwnerData = await fetchPNodeOwnerData(connection, ownerPubkey);

        if (pNodeOwnerData == null || !pNodeOwnerData || pNodeOwnerData?.pnode === 0) {
            return { ok: false, isRegistered: false };
        }

        const pNodeInfoData = await readPnodeInfoArray(connection, ownerPubkey, Number(pNodeOwnerData?.pnode));
        const pnodes = pNodeInfoData.slice(0, Number(pNodeOwnerData?.pnode));

        // check if the pnode(wallet?.publicKey) is there in the pnodes array pnodes.dvenet_pnode or pnodes.mainnet_pnode
        const isRegistered = pnodes.some(pnode =>
            pnode.devnet_pnode.equals(wallet.publicKey) ||
            pnode.mainnet_pnode.equals(wallet.publicKey)
        );

        return { ok: isRegistered, isRegistered };

    } catch (error) {
        return { error: error.message };
    }
}

export { readPnode };

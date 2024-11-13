import { Connection } from "@solana/web3.js"
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";
dotenv.config();


const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

const rpc_endpoint = process.env.RPC_ENDPOINT || "http://elite.swqos.solanavibestation.com/?api_key=adc4e43437685ec96d08a1c96e0f8a5a"
const rpc_websocket_endpoint = process.env.RPC_WEBSOCKET_ENDPOINT || "ws://elite.swqos.solanavibestation.com/?api_key=adc4e43437685ec96d08a1c96e0f8a5a"
const CHECK_FILTER = process.env.CHECK_FILTER || "true"
let pumpfunLogListener: number | null = null


let isBuying = false;
let isBought = false;






const connection = new Connection(rpc_endpoint, { wsEndpoint: rpc_websocket_endpoint, commitment: "confirmed" })

const runListener = () => {

    try {
        console.log("------------------tracker pumpfun------------------")

        pumpfunLogListener = connection.onLogs(
            PUMP_FUN_PROGRAM,
            async ({ logs, err, signature }) => {
                const isMint = logs.filter(log => log.includes("MintTo")).length;
                if (!isBuying && isMint && !isBought) {
                    isBuying = true
                    console.log("========= Found new token in the pump.fun: ===============")
                    console.log("signature:", signature);

                    const parsedTransaction = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
                    console.log(parsedTransaction);
                    if (!parsedTransaction) {
                        console.log("bad Transaction, signature: ", signature);
                        isBuying = false
                        return;
                    }

                    const wallet = parsedTransaction?.transaction.message.accountKeys[0].pubkey;

                    const mint = parsedTransaction?.transaction.message.accountKeys[1].pubkey;

                    const pumpfunBundingCurve = parsedTransaction?.transaction.message.accountKeys[2].pubkey;

                    const ata = parsedTransaction?.transaction.message.accountKeys[3].pubkey;

                    const metaplex = parsedTransaction?.transaction.message.accountKeys[4].pubkey;

                    console.log("wallet================>", wallet);
                    console.log("mint================>", mint);
                    console.log("pumpfunBundingCurve================>", pumpfunBundingCurve);
                    console.log("ata================>", ata);
                    console.log("metaplex================>", metaplex);

                    console.log("🚀 ~ CHECK_FILTER:", CHECK_FILTER);






                }

                console.log(isMint);

            },
            "finalized"
        )

    } catch (error) {
        console.log(error)
    }
}



runListener();

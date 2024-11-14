import { ComputeBudgetProgram, Connection, Keypair, TransactionInstruction, VersionedTransaction } from "@solana/web3.js"
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    closeAccount,
    createAccount,
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddress,
    getMint,
} from "@solana/spl-token"
import { struct } from "@metaplex-foundation/umi/serializers";
import { BONDING_CURV, BONDINGCURVECUSTOM } from "./layout/layout";
import fs from "fs"
import BN from "bn.js";
dotenv.config();


let virtualSolReserves: BN;
let virtualTokenReserves: BN;


const fileName2 = "./config_sniper.json"
let file_content2 = fs.readFileSync(fileName2, 'utf-8');
let content2 = JSON.parse(file_content2);

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || "http://elite.swqos.solanavibestation.com/?api_key=adc4e43437685ec96d08a1c96e0f8a5a"
const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT || "ws://elite.swqos.solanavibestation.com/?api_key=adc4e43437685ec96d08a1c96e0f8a5a"
const CHECK_FILTER = false
const PAYERPRIVATEKEY = process.env.PAYERPRIVATEKEY
const TRADE_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const BONDING_ADDR_SEED = new Uint8Array([98, 111, 110, 100, 105, 110, 103, 45, 99, 117, 114, 118, 101]);




let bonding: PublicKey;
let assoc_bonding_addr: PublicKey;
let pumpfunLogListener: number | null = null

const payerKeypair = Keypair.fromSecretKey(base58.decode(PAYERPRIVATEKEY!));

let isBuying = false;
let isBought = false;

const solIn = content2.solIn;
const txNum = content2.txNum;
const txDelay = content2.txDelay;
const txFee = content2.txFee;
const computeUnit = content2.computeUnit;





const connection = new Connection(RPC_ENDPOINT, { wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed" })

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

                    // check token if the filtering condition is ok
                    if (CHECK_FILTER) {
                        console.log("Hello");
                        isBuying = false;
                    } else {
                        // flase if the filtering condetionis false
                        connection.removeOnLogsListener(pumpfunLogListener!)

                        await getPoolState(mint);

                        console.log("================== Token Buy start ====================");

                        try {
                            connection.removeOnLogsListener(pumpfunLogListener!)
                            console.log("Global listener is removed!");

                        } catch (error) {
                            console.log(error);
                        }

                        //buy transaction
                        await buy(payerKeypair, mint, solIn / 10 ** 9, 10);
                        console.log(solIn);

                        console.log("============================= Token buy end ============================");

                        // const buyerAta = await getAssociatedTokenAddress(mint, payerKeypair.puublicKey)







                    }






                }

                console.log(isMint);

            },
            "finalized"
        )

    } catch (error) {
        console.log(error)
    }
}


const getPoolState = async (mint: PublicKey) => {

    [bonding] = PublicKey.findProgramAddressSync([BONDING_ADDR_SEED, mint.toBuffer()], TRADE_PROGRAM_ID);
    [assoc_bonding_addr] = PublicKey.findProgramAddressSync([bonding.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);

    //get the accountinfo of bonding curve
    const accountInfo = await connection.getAccountInfo(bonding, "processed")
    console.log("🚀 ~ accountInfo:", accountInfo)
    if (!accountInfo) return

    //get the poolstate of the bonding curve
    const poolState = BONDING_CURV.decode(accountInfo.data);
    console.log("🚀 ~ poolState:", poolState)
    console.log("virtualTokenReserves: ", poolState.virtualTokenReserves.toString());
    console.log("realTokenReserves: ", poolState.realTokenReserves.toString());

    //calculate tokens out
    virtualSolReserves = poolState.virtualSolReserves;
    virtualTokenReserves = poolState.virtualTokenReserves;


}




export const buy = async (
    keypair: Keypair,
    mint: PublicKey,
    solIn: number,
    slippageDecimal: number = 0.01
) => {

    console.log("Payer wallet public key is", payerKeypair.publicKey.toBase58())
    const buyerKeypair = keypair
    const buyerWallet = buyerKeypair.publicKey;
    const tokenMint = mint
    let buyerAta = await getAssociatedTokenAddress(tokenMint, buyerWallet)

    console.log("🚀 ~ buyerAta:", buyerAta.toBase58())

    const transation: VersionedTransaction[] = []

    let ixs: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Math.floor(txFee * 10 ** 9 / computeUnit * 10 ** 6) })
    ]





}













runListener();

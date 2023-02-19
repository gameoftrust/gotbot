import Web3 from "web3";
import ReputationGraphAbi from "./abis/ReputationGraph.json";
import NicknameAbi from "./abis/Nickname.json";
import { AbiItem } from "web3-utils";
import { Nickname, ReputationGraph } from "../types/web3-v1-contracts";
import * as dotenv from "dotenv";
import { store } from "./store";
import { selectAccountNickname } from "./store/nickname/selectors";

dotenv.config();

export function isTheSameAddress(address1: string, address2: string) {
  return address1.toLowerCase() === address2.toLowerCase();
}

export function shortenAddress(address: string | null | undefined) {
  if (!address) return "";
  const addressStart = address.substring(0, 6);
  const addressEnd = address.substring(address.length - 4);
  return `${addressStart}...${addressEnd}`;
}

if (!process.env.BLOCKCHAIN_RPC_URL)
  throw new Error("BLOCKCHAIN_RPC_URL is required");
export const web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL);

export const REPUTATION_GRAPH_CONTRACT_ADDRESS =
  process.env.REPUTATION_GRAPH_CONTRACT_ADDRESS;
if (!REPUTATION_GRAPH_CONTRACT_ADDRESS)
  throw new Error("REPUTATION_GRAPH_CONTRACT_ADDRESS is required");

export const reputationGraphContract = new web3.eth.Contract(
  ReputationGraphAbi as AbiItem[],
  REPUTATION_GRAPH_CONTRACT_ADDRESS
) as any as ReputationGraph;

export const NICKNAME_CONTRACT_ADDRESS = process.env.NICKNAME_CONTRACT_ADDRESS;
if (!NICKNAME_CONTRACT_ADDRESS) throw new Error("contractAddress is required");

export const nicknameContract = new web3.eth.Contract(
  NicknameAbi as AbiItem[],
  NICKNAME_CONTRACT_ADDRESS
) as any as Nickname;

export function addressToRepresentation(address: string | null | undefined) {
  if (!address) return "";
  const nickname = selectAccountNickname(store.getState(), address);
  return nickname || shortenAddress(address);
}

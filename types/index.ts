import NodeWalletConnect from "@walletconnect/client";
import { ReputationGraph } from "./web3-v1-contracts";
import { NonPayableTransactionObject } from "./web3-v1-contracts/types";
import { Context, Markup } from "telegraf";
import { ReplyKeyboardMarkup as ReplyKeyboardMarkupType } from "telegraf/src/core/types/typegram";
import {
  ENDORSED_ON_TOPIC_TRANSLATION_KEY,
  NOT_ENDORSED_ON_TOPIC_TRANSLATION_KEY,
  TOPIC_QUESTION_TRANSLATION_KEY,
  TOPIC_TITLE_TRANSLATION_KEY,
} from "../src/i18n";
import { ChatFromGetChat } from "telegraf/types";

export type ReplyKeyboardMarkup = Markup.Markup<ReplyKeyboardMarkupType>;

export enum ParameterKey {
  ENDORSE = "e",
  REPLY = "r",
  VIEW_USER = "u",
}

export type TopicId = string;

export type ClientWallet = NodeWalletConnect;

export enum Scene {
  INITIAL,
  SEND_MESSAGE_TO_GROUP_GET_REPLY_MESSAGE,
  SEND_MESSAGE_TO_GROUP_GET_MESSAGE,
  ENDORSEMENT,
  VIEW_USER,
  VIEW_RECEIVED_ENDORSEMENTS,
  SET_NICKNAME,
  VPN_AGREEMENT,
}

export const SEND_MESSAGE_SCENES = [
  Scene.SEND_MESSAGE_TO_GROUP_GET_REPLY_MESSAGE,
  Scene.SEND_MESSAGE_TO_GROUP_GET_MESSAGE,
];

export const SET_NICKNAME_SCENES = [Scene.SET_NICKNAME];
export const VPN_SCENES = [Scene.VPN_AGREEMENT];

export type ScoreFromContract = ReturnType<
  ReputationGraph["methods"]["scores"]
> extends NonPayableTransactionObject<infer T>
  ? T
  : any;

export type Score = {
  timestamp: ScoreFromContract["timestamp"];
  from: ScoreFromContract["from"];
  to: ScoreFromContract["to"];
  topicId: ScoreFromContract["topicId"];
  score: ScoreFromContract["score"];
  confidence: ScoreFromContract["confidence"];
};

export type NicknameObject = {
  account: string;
  nickname: string;
  timestamp: string;
};

export enum TopicScoreType {
  BINARY = "binary",
  SPECTRUM = "spectrum",
  ONLY_CONFIDENCE = "only_confidence",
  ONLY_SCORE_SPECTRUM = "only_score_spectrum",
}

export type DraftScore = {
  score: number | null | undefined;
  confidence: number | null | undefined;
};

export type ScoreToSubmit = {
  topicId: number;
  score: number;
  confidence: number;
};

export type DraftScores = { [topicId: TopicId]: DraftScore };

export interface SessionData {
  pendingWalletAction: null | {
    id?: string;
    walletAction: (activeClientWallet: ClientWallet) => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  };
  openWalletParameter: string;
  topicIdToViewEndorsements: TopicId | null;
  scene: Scene;
  messageIdToReply: undefined | number;
  userToEndorse: string | null;
  userToEndorseCanAccessGroupBeforeEndorsement: null | boolean;
  userToView: string | null;
  draftScores: DraftScores;
  walletName: string | null;
  clientWallet: ClientWallet | null;
  account: string | null;
  nicknameWarningAcknowledged: boolean;
}

export interface TelegrafContext extends Context {
  session?: SessionData;
}

export interface TelegramBotContext extends TelegrafContext {
  session: SessionData;
}

export class UserDeniedWalletActionError extends Error {}

export interface ReputationGraphMetadata {
  topicNftContract: {
    address: string;
    chainId: number;
  };
  endorsementManifestURI: string;
  mainTopicId: TopicId;
  questionTopicIds: TopicId[];
}

export type TopicMetadata = {
  scoreType: TopicScoreType;
  translations: {
    [locale: string]: {
      [TOPIC_TITLE_TRANSLATION_KEY]: string;
      [TOPIC_QUESTION_TRANSLATION_KEY]: string;
      [ENDORSED_ON_TOPIC_TRANSLATION_KEY]: string;
      [NOT_ENDORSED_ON_TOPIC_TRANSLATION_KEY]: string;
    };
  };
};

export type GraphTopicsMetadata = { [topicId: TopicId]: TopicMetadata };

export type WalletConnection = {
  chatId: number;
  account: string;
};

export type GotSpaceChatInfo = ChatFromGetChat;

export type GotSpaceInvite = {
  account: string;
  spaceChatId: string;
  inviteLink: string;
  timestamp: number;
};

export type GotSpaceMember = {
  account: string;
  userId: number;
  spaceChatId: number;
};

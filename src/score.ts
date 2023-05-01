import { ReputationGraph } from "../types/web3-v1-contracts";
import i18next from "i18next";
import {
  DraftScores,
  ReplyKeyboardMarkup,
  Score,
  ScoreToSubmit,
  TelegramBotContext,
  TopicScoreType,
  UserDeniedWalletActionError,
} from "../types";
import { getSession } from "./session-utils";
import { signTypedDataWithClientWallet } from "./client-wallet";
import {
  addressRepresentationWithLink,
  canAccessBot,
  createKeyboard,
  getChatInvitationLink,
  getMainMenuKeyboard,
  getTelegramApi,
  replyMarkupArguments,
} from "./bot-utils";
import { store } from "./store";
import {
  REPUTATION_GRAPH_CONTRACT_ADDRESS,
  reputationGraphContract,
  web3,
} from "./web3";
import {
  finishOrCancelEndorsementFlow,
  getViewProfileLink,
} from "./bot-utils/endorsementFlow";
import {
  selectGraphId,
  selectIsEvaluatedBy,
  selectQuestionTopicIds,
  selectTopicScoreType,
} from "./store/reputationGraph/selectors";
import { fetchScores } from "./store/reputationGraph/actions";
import { selectAccountHashLastConnection } from "./store/walletConnections/selectors";
import { keccak256 } from "@ethersproject/keccak256";
import * as fs from "fs";
import { EXPLORER_URL } from "./constants";
import { getChatTypeTranslationArg } from "./i18n";

export const getInitialDraftScores = () => {
  const questionTopicIds = selectQuestionTopicIds(store.getState());
  return questionTopicIds.reduce((draftScores, topicId) => {
    draftScores[topicId] = {
      score: undefined,
      confidence: undefined,
    };
    return draftScores;
  }, {} as DraftScores);
};

export async function endorseUserWithSignature(
  ...args: Parameters<ReputationGraph["methods"]["endorse"]>
) {
  const privateKey = process.env.ENDORSER_PRIVATE_KEY;
  if (!privateKey) throw new Error("privateKey is required");
  const fromAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address;

  const nonce = await web3.eth.getTransactionCount(fromAddress);
  const gasPrice = await web3.eth.getGasPrice();
  const data = reputationGraphContract.methods.endorse(...args).encodeABI();

  const tx = {
    from: fromAddress,
    to: REPUTATION_GRAPH_CONTRACT_ADDRESS,
    data: data,
    nonce: nonce,
    gasPrice: gasPrice,
  };
  const gasLimit = await web3.eth.estimateGas(tx);

  const txWithGasEstimation = {
    ...tx,
    gasLimit: gasLimit,
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    txWithGasEstimation,
    privateKey
  );
  return web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
}

export function getEndorsementTypedData(
  timestamp: number,
  from: string,
  to: string,
  scores: ScoreToSubmit[]
) {
  const domain = {
    name: "Game of Trust",
    version: "1",
  };
  const graphId = selectGraphId(store.getState());
  return JSON.stringify({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      RawScore: [
        { name: "topicId", type: "uint256" },
        { name: "score", type: "int8" },
        {
          name: "confidence",
          type: "uint8",
        },
      ],
      Endorsement: [
        { name: "timestamp", type: "uint256" },
        { name: "from", type: "address" },
        {
          name: "to",
          type: "address",
        },
        {
          name: "graphId",
          type: "address",
        },
        {
          name: "scores",
          type: "RawScore[]",
        },
      ],
    },
    primaryType: "Endorsement",
    domain,
    message: {
      timestamp,
      from,
      to,
      graphId,
      scores,
    },
  });
}

export async function handleAfterEndorsement(ctx: TelegramBotContext) {
  try {
    await store.dispatch(fetchScores());
    const { account, userToEndorse } = getSession(ctx);
    if (!account) throw new Error("account not provided");
    if (!userToEndorse) throw new Error("userToEndorse not provided");
    const walletConnection = selectAccountHashLastConnection(
      store.getState(),
      keccak256(userToEndorse.toLowerCase())
    );
    if (!walletConnection) return;
    if (!selectIsEvaluatedBy(store.getState(), [userToEndorse, account])) {
      await getTelegramApi(ctx).sendMessage(
        walletConnection.userId,
        i18next.t("endorseTheEndorserMessage", {
          userProfile: addressRepresentationWithLink(ctx, account, false),
          endorsementLink: getViewProfileLink(ctx, account),
        }),
        {
          parse_mode: "Markdown",
        }
      );
    }
    if (
      ctx.session.userToEndorseCanAccessGroupBeforeEndorsement === false &&
      canAccessBot(userToEndorse)
    ) {
      const inviteLink = await getChatInvitationLink(ctx);
      await getTelegramApi(ctx).sendMessage(
        walletConnection.userId,
        i18next.t("inviteToChat", {
          inviteLink: inviteLink.invite_link,
          ...getChatTypeTranslationArg(),
        }),
        {
          disable_web_page_preview: true,
        }
      );
      await getTelegramApi(ctx).sendMessage(
        walletConnection.userId,
        i18next.t("mainMenu"), //[‌](https://www.google.com/${signatue})
        {
          ...replyMarkupArguments(getMainMenuKeyboard()),
        }
      );
    }
  } catch (e) {
    console.log(e);
  }
}

export async function submitEndorsement(ctx: TelegramBotContext) {
  const { account, draftScores, userToEndorse } = getSession(ctx);
  if (!account) throw new Error("account not provided");
  if (!userToEndorse) throw new Error("userToEndorse not provided");
  const state = store.getState();
  const graphId = selectGraphId(state);
  const questionTopicIds = selectQuestionTopicIds(state);
  const scoresToSubmit: ScoreToSubmit[] = questionTopicIds
    .filter((topicId) => draftScores[topicId].score !== null)
    .map((topicId) => ({
      topicId: Number(topicId),
      score: draftScores[topicId].score!,
      confidence: draftScores[topicId].confidence!,
    }));
  const timestamp = Math.floor(Date.now() / 1000);
  const typedData = getEndorsementTypedData(
    timestamp,
    account,
    userToEndorse,
    scoresToSubmit
  );
  let signature: string | null = null;
  try {
    signature = await signTypedDataWithClientWallet(ctx, typedData);
  } catch (e) {
    if (e instanceof UserDeniedWalletActionError) {
      await ctx.reply(i18next.t("signatureRejected"));
    } else {
      console.log(e);
      await ctx.reply(String(e));
    }
  }
  if (signature) {
    await ctx.reply(i18next.t("signatureAccepted"));
    try {
      const endorsement: Parameters<ReputationGraph["methods"]["endorse"]>[0] =
        [
          timestamp,
          account,
          userToEndorse,
          graphId,
          scoresToSubmit.map((scoresToSubmit) => [
            scoresToSubmit.topicId,
            scoresToSubmit.score,
            scoresToSubmit.confidence,
          ]),
        ];
      if (process.env.REPUTATION_GRAPH_CONTRACT_CALL_LOG_PATH) {
        fs.appendFile(
          process.env.REPUTATION_GRAPH_CONTRACT_CALL_LOG_PATH,
          JSON.stringify({
            endorsement,
            signature,
          }),
          (err) => {
            if (err) {
              console.error("Error appending to file:", err);
            }
          }
        );
      }
      const tx = await endorseUserWithSignature(endorsement, signature);
      await handleAfterEndorsement(ctx);
      const txLink = EXPLORER_URL
        ? "\n\n" +
          i18next.t("transactionExplorerLink", {
            txLink: `${EXPLORER_URL}/tx/${tx.transactionHash}`,
          })
        : "";
      await ctx.reply(i18next.t("endorsementSubmitted") + txLink, {
        parse_mode: "MarkdownV2",
      });
      if (
        process.env.SEND_TWO_SIDED_ENDORSEMENT_MESSAGE_AFTER_ENDORSEMENT ===
          "true" &&
        !selectIsEvaluatedBy(store.getState(), [userToEndorse, account])
      ) {
        await ctx.reply(
          i18next.t("afterEndorsementDescription", {
            endorsementLink: getViewProfileLink(ctx, account),
          })
        );
      }
    } catch (e) {
      console.log(e);
      await ctx.reply(i18next.t("txError"));
      await ctx.reply(String(e));
    }
  }
  return finishOrCancelEndorsementFlow(ctx);
}

export type ValueMap = {
  [key: string]: number | null;
};

export const getBinaryScoreValues = (): ValueMap => ({
  [i18next.t("endorsementActions.noIdea")]: null,
  [i18next.t("endorsementActions.no")]: -120,
  [i18next.t("endorsementActions.yes")]: 120,
});

export const getSpectrumScoreValues = (): ValueMap => ({
  [i18next.t("endorsementActions.noIdea")]: null,
  [i18next.t("endorsementActions.low")]: 30,
  [i18next.t("endorsementActions.medium")]: 60,
  [i18next.t("endorsementActions.high")]: 90,
  [i18next.t("endorsementActions.very_high")]: 120,
});

export const getOnlyYesScoreValues = (): ValueMap => ({
  [i18next.t("endorsementActions.noIdea")]: null,
  [i18next.t("endorsementActions.yes")]: 120,
});

export function getScoreValues(topicScoreType: TopicScoreType): ValueMap {
  switch (topicScoreType) {
    case TopicScoreType.BINARY:
      return getBinaryScoreValues();
    case TopicScoreType.SPECTRUM:
    case TopicScoreType.ONLY_SCORE_SPECTRUM:
      return getSpectrumScoreValues();
    case TopicScoreType.ONLY_CONFIDENCE:
      return getOnlyYesScoreValues();
  }
}

export const getConfidenceValues = (
  topicScoreType: TopicScoreType
): ValueMap => {
  switch (topicScoreType) {
    case TopicScoreType.BINARY:
    case TopicScoreType.SPECTRUM:
    case TopicScoreType.ONLY_CONFIDENCE:
      return {
        [i18next.t("endorsementActions.low")]: 30,
        [i18next.t("endorsementActions.medium")]: 60,
        [i18next.t("endorsementActions.high")]: 90,
        [i18next.t("endorsementActions.very_high")]: 120,
      };
    case TopicScoreType.ONLY_SCORE_SPECTRUM:
      return {
        [i18next.t("endorsementActions.very_high")]: 120,
      };
  }
};

const spectrumKeyboard = () =>
  createKeyboard([
    [i18next.t("endorsementActions.noIdea")!],
    [
      i18next.t("endorsementActions.medium")!,
      i18next.t("endorsementActions.low")!,
    ],
    [
      i18next.t("endorsementActions.very_high")!,
      i18next.t("endorsementActions.high")!,
    ],
    [i18next.t("endorsementActions.cancel")!],
  ]);

export const scoreKeyboards: {
  [topicScoreType in TopicScoreType]: () => ReplyKeyboardMarkup;
} = {
  [TopicScoreType.BINARY]: () =>
    createKeyboard([
      [i18next.t("endorsementActions.noIdea")!],
      [
        i18next.t("endorsementActions.yes")!,
        i18next.t("endorsementActions.no")!,
      ],
      [i18next.t("endorsementActions.cancel")!],
    ]),
  [TopicScoreType.SPECTRUM]: spectrumKeyboard,
  [TopicScoreType.ONLY_CONFIDENCE]: spectrumKeyboard,
  [TopicScoreType.ONLY_SCORE_SPECTRUM]: spectrumKeyboard,
};

export const confidenceKeyboard = () =>
  createKeyboard([
    [
      i18next.t("endorsementActions.medium")!,
      i18next.t("endorsementActions.low")!,
    ],
    [
      i18next.t("endorsementActions.very_high")!,
      i18next.t("endorsementActions.high")!,
    ],
    [i18next.t("endorsementActions.cancel")!],
  ]);

export async function scoreSourceRepresentation(
  ctx: TelegramBotContext,
  score: Score
) {
  return i18next.t("endorsementFromAccount", {
    fromAccount: addressRepresentationWithLink(ctx, score.from),
  });
}

export async function scoreDestinationRepresentation(
  ctx: TelegramBotContext,
  score: Score
) {
  return i18next.t("endorsementToAccount", {
    toAccount: addressRepresentationWithLink(ctx, score.to),
  });
}

export async function scoreToRepresentation(
  ctx: TelegramBotContext,
  score: Score
) {
  const scoreType = selectTopicScoreType(store.getState(), score.topicId);

  const scoreValues = getScoreValues(scoreType);
  const confidenceValues = getConfidenceValues(scoreType);

  const scoreString =
    i18next.t("score") +
    ": " +
    Object.keys(scoreValues).find(
      (s) => scoreValues[s] === Number(score.score)
    );
  const confidenceString =
    i18next.t("confidenceInScore") +
    ": " +
    Object.keys(confidenceValues).find(
      (s) => confidenceValues[s] === Number(score.confidence)
    );

  if (scoreType === TopicScoreType.ONLY_SCORE_SPECTRUM) {
    return scoreString;
  } else if (scoreType === TopicScoreType.ONLY_CONFIDENCE) {
    return confidenceString;
  }
  return scoreString + "\n" + confidenceString;
}

export function getMaximumConfidenceValue(scoreType: TopicScoreType) {
  const confidenceValues = getConfidenceValues(scoreType);
  return Math.max(
    ...(Object.values(confidenceValues).filter((v) => v !== null) as number[])
  );
}

export function getMaximumScoreValue(scoreType: TopicScoreType) {
  const scoreValues = getScoreValues(scoreType);
  return Math.max(
    ...(Object.values(scoreValues).filter((v) => v !== null) as number[])
  );
}

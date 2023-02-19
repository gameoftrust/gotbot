import {
  ParameterKey,
  Scene,
  TelegramBotContext,
  TopicId,
  TopicScoreType,
} from "../../types";
import { getSession, resetSession } from "../session-utils";
import i18next from "i18next";
import {
  confidenceKeyboard,
  getConfidenceValues,
  getMaximumConfidenceValue,
  getScoreValues,
  scoreKeyboards,
  submitEndorsement,
} from "../score";
import { openWalletButton } from "../client-wallet";
import {
  canAccessBot,
  createKeyboard,
  getBotInfo,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";
import {
  TOPIC_QUESTION_TRANSLATION_KEY,
  TOPICS_TRANSLATION_PREFIX,
} from "../i18n";
import { store } from "../store";
import {
  selectQuestionTopicIds,
  selectTopicScoreType,
} from "../store/reputationGraph/selectors";
import { addressToRepresentation } from "../web3";

export function setUserToEndorse(
  ctx: TelegramBotContext,
  userToEndorse: string
) {
  ctx.session.userToEndorse = userToEndorse;
  ctx.session.userToEndorseCanAccessGroupBeforeEndorsement =
    canAccessBot(userToEndorse);
}

export async function sendTopicQuestion(
  ctx: TelegramBotContext,
  topicId: TopicId
) {
  const scoreType = selectTopicScoreType(store.getState(), topicId);
  return ctx.reply(
    i18next.t(
      TOPICS_TRANSLATION_PREFIX +
        "." +
        topicId +
        "." +
        TOPIC_QUESTION_TRANSLATION_KEY
    ),
    {
      parse_mode: "Markdown",
      ...replyMarkupArguments(scoreKeyboards[scoreType]()),
    }
  );
}

export function getViewProfileLink(ctx: TelegramBotContext, address: string) {
  return `https://t.me/${getBotInfo(ctx).username}?start=${
    ParameterKey.VIEW_USER
  }=${address}`;
}

export function getEndorsementLink(ctx: TelegramBotContext, address: string) {
  return `https://t.me/${getBotInfo(ctx).username}?start=${
    ParameterKey.ENDORSE
  }=${address}`;
}

export function finishOrCancelEndorsementFlow(ctx: TelegramBotContext) {
  resetSession(ctx);
  return handleConnectedUserState(ctx);
}

export async function handleEndorsementFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const session = getSession(ctx);
  const { account, userToEndorse, scene, draftScores } = session;
  const state = store.getState();
  const questionTopicIds = selectQuestionTopicIds(state);

  if (!account) throw new Error("account not provided");

  if (!userToEndorse) throw new Error("userToEndorse not provided");

  if (account === userToEndorse) {
    await ctx.reply(i18next.t("cantEndorseYourself"));
    return finishOrCancelEndorsementFlow(ctx);
  }

  if (message === i18next.t("endorsementActions.cancel")) {
    return finishOrCancelEndorsementFlow(ctx);
  }

  if (scene === Scene.INITIAL) {
    if (message === i18next.t("endorsementActions.okGotIt")) {
      ctx.session.scene = Scene.ENDORSEMENT;
      return sendTopicQuestion(ctx, questionTopicIds[0]);
    }
    return ctx.reply(
      i18next.t("endorsementGuide", {
        userProfile: "`" + addressToRepresentation(userToEndorse) + "`",
      }),
      {
        parse_mode: "Markdown",
        ...replyMarkupArguments(
          createKeyboard([
            [i18next.t("endorsementActions.okGotIt")!],
            [i18next.t("endorsementActions.cancel")!],
          ])
        ),
      }
    );
  }

  let i = 0;
  while (i < questionTopicIds.length) {
    const topicId = questionTopicIds[i];
    const scoreIsNotSet = draftScores[topicId].score === undefined;
    if (scoreIsNotSet) break;
    const scoreIsNotNoIdea = draftScores[topicId].score !== null;
    const confidenceIsNotSet =
      scoreIsNotNoIdea && draftScores[topicId].confidence === undefined;
    if (confidenceIsNotSet) break;
    i++;
  }
  if (message) {
    if (i === questionTopicIds.length)
      return ctx.reply(i18next.t("confirmScoresSignature"), {
        ...replyMarkupArguments(openWalletButton(ctx)),
      });
    const topicId = questionTopicIds[i];
    const scoreType = selectTopicScoreType(state, topicId);
    const draftScore = draftScores[topicId];
    const confidenceValues = getConfidenceValues(scoreType);
    const scoreValues = getScoreValues(scoreType);
    if (draftScore.score === undefined) {
      if (message === i18next.t("endorsementActions.noIdea")) {
        session.draftScores = {
          ...session.draftScores,
          [topicId]: {
            ...draftScore,
            score: scoreValues[message],
          },
        };
        i++;
      } else {
        if (scoreType === TopicScoreType.ONLY_CONFIDENCE) {
          if (!Object.keys(confidenceValues).includes(message)) {
            return ctx.reply(i18next.t("invalidValue"), {
              ...replyMarkupArguments(confidenceKeyboard()),
            });
          }
          session.draftScores = {
            ...session.draftScores,
            [topicId]: {
              ...draftScore,
              score: scoreValues[i18next.t("endorsementActions.yes")],
              confidence: confidenceValues[message],
            },
          };
          i++;
        } else {
          if (!Object.keys(scoreValues).includes(message)) {
            return ctx.reply(i18next.t("invalidValue"), {
              ...replyMarkupArguments(scoreKeyboards[scoreType]()),
            });
          }
          session.draftScores = {
            ...session.draftScores,
            [topicId]: {
              ...draftScore,
              score: scoreValues[message],
              confidence:
                scoreType === TopicScoreType.ONLY_SCORE_SPECTRUM
                  ? getMaximumConfidenceValue(scoreType)
                  : draftScore.confidence,
            },
          };
          if (scoreType === TopicScoreType.ONLY_SCORE_SPECTRUM) {
            i++;
          }
        }
      }
    } else {
      if (!Object.keys(confidenceValues).includes(message)) {
        return ctx.reply(i18next.t("invalidValue"), {
          ...replyMarkupArguments(confidenceKeyboard()),
        });
      }
      session.draftScores = {
        ...session.draftScores,
        [topicId]: {
          ...draftScore,
          confidence: confidenceValues[message],
        },
      };
      i++;
    }
  }
  if (i < questionTopicIds.length) {
    const topicId = questionTopicIds[i];
    const draftScore = session.draftScores[topicId];
    if (draftScore.score === undefined) {
      return sendTopicQuestion(ctx, topicId);
    } else {
      return ctx.reply(i18next.t("howConfidentAreYouInYourAnswer"), {
        ...replyMarkupArguments(confidenceKeyboard()),
      });
    }
  } else {
    return submitEndorsement(ctx);
  }
}

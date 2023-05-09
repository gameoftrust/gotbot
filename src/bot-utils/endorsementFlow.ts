import {
  ParameterKey,
  Scene,
  TelegramBotContext,
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
import { sendConfirmSignatureMessage } from "../client-wallet";
import {
  canAccessBot,
  createKeyboard,
  getBotInfo,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";
import { getTopicQuestion } from "../i18n";
import { store } from "../store";
import {
  selectEndorsementManifestURI,
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

export function getViewProfileLink(ctx: TelegramBotContext, address: string) {
  return `https://t.me/${getBotInfo(ctx).username}?start=${
    ParameterKey.VIEW_USER
  }=${address}`;
}

export function getProfileLink(ctx: TelegramBotContext, address: string) {
  return `https://t.me/${getBotInfo(ctx).username}?start=${
    ParameterKey.ENDORSE
  }=${address}`;
}

export function finishEndorsementFlow(ctx: TelegramBotContext) {
  resetSession(ctx);
  return handleConnectedUserState(ctx);
}

export function getLastUnansweredQuestionTopicIndex(ctx: TelegramBotContext) {
  const { draftScores } = getSession(ctx);
  const questionTopicIds = selectQuestionTopicIds(store.getState());
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
  return i;
}

const keyboardBottomRowCancel = () => [i18next.t("endorsementActions.cancel")];
const keyboardBottomRowCancelAndPreviousQuestion = () => [
  i18next.t("endorsementActions.cancel"),
  i18next.t("endorsementActions.previousQuestion"),
];

export async function handleEndorsementFlowNextAction(ctx: TelegramBotContext) {
  const { draftScores } = getSession(ctx);
  const state = store.getState();
  const questionTopicIds = selectQuestionTopicIds(state);
  const i = getLastUnansweredQuestionTopicIndex(ctx);
  if (i < questionTopicIds.length) {
    const topicId = questionTopicIds[i];
    const draftScore = draftScores[topicId];
    const keyboardBottomRow: string[] =
      i === 0 && draftScore.score === undefined
        ? keyboardBottomRowCancel()
        : keyboardBottomRowCancelAndPreviousQuestion();
    if (draftScore.score === undefined) {
      const scoreType = selectTopicScoreType(state, topicId);
      return ctx.reply(getTopicQuestion(topicId), {
        parse_mode: "Markdown",
        ...replyMarkupArguments(
          createKeyboard([...scoreKeyboards[scoreType](), keyboardBottomRow])
        ),
      });
    } else {
      return ctx.reply(i18next.t("howConfidentAreYouInYourAnswer"), {
        ...replyMarkupArguments(
          createKeyboard([
            ...confidenceKeyboard(),
            keyboardBottomRowCancelAndPreviousQuestion(),
          ])
        ),
      });
    }
  } else {
    return submitEndorsement(ctx);
  }
}

export async function handleEndorsementFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const session = getSession(ctx);
  const { account, userToEndorse, scene, draftScores } = session;
  const state = store.getState();
  const questionTopicIds = selectQuestionTopicIds(state);
  const endorsementManifestURI = selectEndorsementManifestURI(state);

  if (!account) throw new Error("account not provided");

  if (!userToEndorse) throw new Error("userToEndorse not provided");

  if (account === userToEndorse) {
    await ctx.reply(i18next.t("cantEndorseYourself"));
    return finishEndorsementFlow(ctx);
  }

  if (message === i18next.t("endorsementActions.cancel")) {
    const u = session.userToView;
    resetSession(ctx);
    ctx.session.userToView = u;
    return handleConnectedUserState(ctx);
  }

  if (scene === Scene.INITIAL) {
    if (message === i18next.t("endorsementActions.okGotIt")) {
      ctx.session.scene = Scene.ENDORSEMENT;
      const topicId = questionTopicIds[0];
      const scoreType = selectTopicScoreType(state, topicId);
      return ctx.reply(getTopicQuestion(topicId), {
        parse_mode: "Markdown",
        ...replyMarkupArguments(
          createKeyboard([
            ...scoreKeyboards[scoreType](),
            keyboardBottomRowCancel(),
          ])
        ),
      });
    }
    return ctx.reply(
      i18next.t("endorsementGuide", {
        endorsementManifestLink: endorsementManifestURI,
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

  const index = getLastUnansweredQuestionTopicIndex(ctx);
  if (message) {
    if (index === questionTopicIds.length) {
      return sendConfirmSignatureMessage(ctx);
    }
    const topicId = questionTopicIds[index];
    const draftScore = draftScores[topicId];
    if (message === i18next.t("endorsementActions.previousQuestion")) {
      const prevTopicId = questionTopicIds[Math.max(0, index - 1)];
      const topicIdToClear =
        draftScore.score === undefined ? prevTopicId : topicId;
      session.draftScores = {
        ...session.draftScores,
        [topicIdToClear]: {
          score: undefined,
          confidence: undefined,
        },
      };
      return handleEndorsementFlowNextAction(ctx);
    }

    const keyboardBottomRow: string[] =
      index === 0 && draftScore.score === undefined
        ? keyboardBottomRowCancel()
        : keyboardBottomRowCancelAndPreviousQuestion();
    const scoreType = selectTopicScoreType(state, topicId);
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
      } else {
        if (scoreType === TopicScoreType.ONLY_CONFIDENCE) {
          if (!Object.keys(confidenceValues).includes(message)) {
            return ctx.reply(i18next.t("invalidValue"), {
              ...replyMarkupArguments(
                createKeyboard([...confidenceKeyboard(), keyboardBottomRow])
              ),
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
        } else {
          if (!Object.keys(scoreValues).includes(message)) {
            return ctx.reply(i18next.t("invalidValue"), {
              ...replyMarkupArguments(
                createKeyboard([
                  ...scoreKeyboards[scoreType](),
                  keyboardBottomRow,
                ])
              ),
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
        }
      }
    } else {
      if (!Object.keys(confidenceValues).includes(message)) {
        return ctx.reply(i18next.t("invalidValue"), {
          ...replyMarkupArguments(
            createKeyboard([...confidenceKeyboard(), keyboardBottomRow])
          ),
        });
      }
      session.draftScores = {
        ...session.draftScores,
        [topicId]: {
          ...draftScore,
          confidence: confidenceValues[message],
        },
      };
    }
  }
  return handleEndorsementFlowNextAction(ctx);
}

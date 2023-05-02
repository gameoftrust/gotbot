import { Scene, Score, TelegramBotContext, TopicId } from "../../types";
import i18next from "i18next";
import { getSession, resetSession } from "../session-utils";
import { addressToRepresentation, isTheSameAddress } from "../web3";
import { handleEndorsementFlow, setUserToEndorse } from "./endorsementFlow";
import {
  createKeyboard,
  findMainTopicEndorsementPath,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";
import {
  ENDORSED_ON_TOPIC_TRANSLATION_KEY,
  getTopicQuestion,
  getTopicTitle,
  NOT_ENDORSED_ON_TOPIC_TRANSLATION_KEY,
  TOPICS_TRANSLATION_PREFIX,
} from "../i18n";
import { store } from "../store";
import { findPerfectEndorsementPath } from "../web-of-trust";
import {
  scoreDestinationRepresentation,
  scoreSourceRepresentation,
  scoreToRepresentation,
} from "../score";
import {
  selectEndorsementsGraph,
  selectQuestionTopicIds,
} from "../store/reputationGraph/selectors";

function representIntermediaryCount(endorsementPath: Score[]) {
  return endorsementPath.length === 1
    ? i18next.t("viewProfile.youEndorsedThisPersonDirectly")
    : i18next.t(
        "viewProfile.thisPersonReceivedEndorsementFromYouWithNIntermediaries",
        {
          n: endorsementPath.length - 1,
        }
      );
}

async function getEndorsementPathBrief(
  endorsementPath: Score[] | null,
  topicId: TopicId
) {
  return endorsementPath
    ? i18next.t(
        TOPICS_TRANSLATION_PREFIX +
          "." +
          topicId +
          "." +
          ENDORSED_ON_TOPIC_TRANSLATION_KEY
      ) +
        "\n" +
        representIntermediaryCount(endorsementPath)
    : i18next.t(
        TOPICS_TRANSLATION_PREFIX +
          "." +
          topicId +
          "." +
          NOT_ENDORSED_ON_TOPIC_TRANSLATION_KEY
      );
}

async function viewUserProfileInitialScene(ctx: TelegramBotContext) {
  const { account, userToView } = getSession(ctx);
  if (!account) throw new Error("account not provided");
  if (!userToView) throw new Error("userToView not provided");
  const {
    reputationGraph: {
      metadata: { mainTopicId },
    },
  } = store.getState();
  const endorsementPath = findMainTopicEndorsementPath(account, userToView);
  return ctx.reply(
    i18next.t("viewProfile.viewUserMessage", {
      userProfile: "`" + addressToRepresentation(userToView) + "`",
    }) +
      "\n" +
      (await getEndorsementPathBrief(endorsementPath, mainTopicId)) +
      "\n" +
      i18next.t("whatWouldYouLikeToDo"),
    {
      parse_mode: "Markdown",
      ...replyMarkupArguments(
        createKeyboard([
          [i18next.t("viewProfile.viewReceivedEndorsements")!],
          [i18next.t("viewProfile.endorseUser")!],
          [i18next.t("returnToMainMenu")!],
        ])
      ),
    }
  );
}

async function viewUserProfileEndorsementsOnTopic(ctx: TelegramBotContext) {
  const { account, userToView, topicIdToViewEndorsements } = getSession(ctx);
  if (!topicIdToViewEndorsements)
    throw new Error("topicIdToViewEndorsements not provided");
  if (!account) throw new Error("account not provided");
  if (!userToView) throw new Error("userToView not provided");

  const endorsementPath = findPerfectEndorsementPath(
    account,
    userToView,
    topicIdToViewEndorsements
  );

  const brief = await getEndorsementPathBrief(
    endorsementPath,
    topicIdToViewEndorsements
  );

  const question =
    i18next.t("question") +
    ": " +
    i18next.t(getTopicQuestion(topicIdToViewEndorsements));

  const endorsementPathRepresentations: string[] = [];
  if (endorsementPath) {
    for (let i = 0; i < endorsementPath.length; i++) {
      const score = endorsementPath[i];
      const sourceString = await scoreSourceRepresentation(ctx, score);
      const destinationString = await scoreDestinationRepresentation(
        ctx,
        score
      );
      endorsementPathRepresentations.push(
        `${sourceString} ${destinationString}` +
          "\n" +
          (await scoreToRepresentation(ctx, score))
      );
    }
  }
  const endorsementPathString = endorsementPath
    ? `${i18next.t(
        "viewProfile.yourEndorsementPathToThisPerson"
      )}:\n\n${endorsementPathRepresentations.join("\n\n")}\n${i18next.t(
        "markdownHorizontalLine"
      )}\n`
    : "";

  const endorsements = selectEndorsementsGraph(store.getState());
  const endorsementsReceivedDirectlyByThisPerson = endorsements.filter(
    (e) =>
      e.topicId === topicIdToViewEndorsements &&
      e.to === userToView.toLowerCase()
  );
  const endorsementsReceivedRepresentations: string[] = [];
  for (let i = 0; i < endorsementsReceivedDirectlyByThisPerson.length; i++) {
    const score = endorsementsReceivedDirectlyByThisPerson[i];
    const sourceString = await scoreSourceRepresentation(ctx, score);
    endorsementsReceivedRepresentations.push(
      sourceString + "\n" + (await scoreToRepresentation(ctx, score))
    );
  }
  const endorsementsReceivedString = `${i18next.t(
    "viewProfile.endorsementsReceivedDirectlyByThisPerson"
  )}:\n\n${endorsementsReceivedRepresentations.join("\n\n")}`;

  return ctx.reply(
    i18next.t("viewProfile.viewUserMessage", {
      userProfile: "`" + addressToRepresentation(userToView) + "`",
    }) +
      "\n\n" +
      question +
      "\n\n" +
      brief +
      `\n${i18next.t("markdownHorizontalLine")}\n` +
      endorsementPathString +
      endorsementsReceivedString,
    {
      parse_mode: "Markdown",
    }
  );
}

export async function chooseEndorsementTopicMessage(ctx: TelegramBotContext) {
  const questionTopicIds = selectQuestionTopicIds(store.getState());
  return ctx.reply(i18next.t("viewProfile.chooseEndorsementTopic"), {
    ...replyMarkupArguments(
      createKeyboard([
        ...questionTopicIds.map((topicId) => [getTopicTitle(topicId)]),
        [i18next.t("return")],
      ])
    ),
  });
}

export async function handleViewUserFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const session = getSession(ctx);
  const { account, userToView, scene } = session;
  if (!account) throw new Error("account not provided");
  if (!userToView) throw new Error("userToView not provided");
  const state = store.getState();

  if (isTheSameAddress(account, userToView)) {
    resetSession(ctx);
    await ctx.reply(i18next.t("viewProfile.viewProfileSelf"));
    return handleConnectedUserState(ctx);
  }

  if (message === i18next.t("returnToMainMenu")) {
    resetSession(ctx);
    return handleConnectedUserState(ctx);
  }

  if (scene === Scene.VIEW_RECEIVED_ENDORSEMENTS) {
    if (message === i18next.t("return")) {
      ctx.session.topicIdToViewEndorsements = null;
      ctx.session.scene = Scene.VIEW_USER;
      return viewUserProfileInitialScene(ctx);
    }
    const questionTopicIds = selectQuestionTopicIds(state);
    for (let i = 0; i < questionTopicIds.length; i++) {
      const topicId = questionTopicIds[i];
      if (message === getTopicTitle(topicId)) {
        ctx.session.topicIdToViewEndorsements = topicId;
        await viewUserProfileEndorsementsOnTopic(ctx);
      }
    }
    return chooseEndorsementTopicMessage(ctx);
  }

  if (scene === Scene.VIEW_USER) {
    if (message === i18next.t("viewProfile.endorseUser")) {
      resetSession(ctx);
      ctx.session.userToView = userToView;
      setUserToEndorse(ctx, userToView);
      return handleEndorsementFlow(ctx, message);
    }

    if (message === i18next.t("viewProfile.viewReceivedEndorsements")) {
      ctx.session.scene = Scene.VIEW_RECEIVED_ENDORSEMENTS;
      return chooseEndorsementTopicMessage(ctx);
    }

    return viewUserProfileInitialScene(ctx);
  }

  if (scene === Scene.INITIAL) {
    ctx.session.scene = Scene.VIEW_USER;
    return viewUserProfileInitialScene(ctx);
  }
}

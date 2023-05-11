import { GotSpaceInvite, TelegramBotContext } from "../../types";
import { getBotInfo, getTelegramApi } from "./index";
import { store } from "../store";
import { setSpaceInvites, setSpaceMembers } from "../store/gotSpaces";
import { getSession } from "../session-utils";
import { NarrowedContext } from "telegraf";
import { Update } from "typegram";

export function revokeSpaceInviteLink(
  ctx: TelegramBotContext,
  i: GotSpaceInvite
) {
  getTelegramApi(ctx)
    .revokeChatInviteLink(i.spaceChatId, i.inviteLink)
    .catch(console.log);
}

//TODO: convert these to async redux thunks
export async function getChatInvitationLinkForCurrentUser(
  ctx: TelegramBotContext,
  spaceChatId: number
) {
  const { account } = getSession(ctx);
  if (!account) throw new Error("account not provided");
  const inviteLinkObject = await getTelegramApi(ctx).createChatInviteLink(
    spaceChatId,
    {
      creates_join_request: true,
    }
  );
  const inviteLink = inviteLinkObject.invite_link;
  const currentSpaceInvites = store.getState().gotSpaces.spaceInvites;
  const spaceInviteLinksToRevoke = currentSpaceInvites.filter(
    (i) => i.spaceChatId === spaceChatId && i.account === account
  );
  store.dispatch(
    setSpaceInvites([
      ...currentSpaceInvites.filter(
        (i) => i.spaceChatId != spaceChatId || i.account != account
      ),
      {
        account,
        spaceChatId,
        inviteLink,
        timestamp: new Date().getTime(),
      },
    ])
  );
  spaceInviteLinksToRevoke.forEach((invitation) => {
    revokeSpaceInviteLink(ctx, invitation);
  });
  return inviteLink;
}

export async function handleChatJoinRequest(
  ctx: NarrowedContext<TelegramBotContext, Update.ChatJoinRequestUpdate>
) {
  const chatJoinRequest = ctx.update.chat_join_request;
  const userToJoinId = chatJoinRequest.from.id;
  if (chatJoinRequest.invite_link?.creator.id !== getBotInfo(ctx).id) return;
  const currentSpaceInvites = store.getState().gotSpaces.spaceInvites;
  const invitation = currentSpaceInvites.find(
    (i) =>
      i.spaceChatId === chatJoinRequest.chat.id &&
      i.inviteLink === chatJoinRequest.invite_link?.invite_link
  );
  if (!invitation) {
    getTelegramApi(ctx)
      .revokeChatInviteLink(
        chatJoinRequest.chat.id,
        chatJoinRequest.invite_link?.invite_link
      )
      .catch(console.log);
    getTelegramApi(ctx)
      .declineChatJoinRequest(chatJoinRequest.chat.id, userToJoinId)
      .catch(console.log);
    return;
  }
  await getTelegramApi(ctx).approveChatJoinRequest(
    chatJoinRequest.chat.id,
    userToJoinId
  );
  const currentSpaceMembers = store.getState().gotSpaces.spaceMembers;
  store.dispatch(
    setSpaceMembers([
      ...currentSpaceMembers,
      {
        account: invitation.account,
        spaceChatId: invitation.spaceChatId,
        userId: userToJoinId,
      },
    ])
  );
  revokeSpaceInviteLink(ctx, invitation);
  store.dispatch(
    setSpaceInvites(
      currentSpaceInvites.filter(
        (i) => i.inviteLink != chatJoinRequest.invite_link?.invite_link
      )
    )
  );
}

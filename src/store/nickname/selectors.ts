import { createSelector } from "@reduxjs/toolkit";
import { NicknameObject } from "../../../types";
import { RootState } from "../index";

export function filterOldNicknames(
  nicknameObjects: NicknameObject[]
): NicknameObject[] {
  const reversedArr = Array.from(nicknameObjects);
  reversedArr.sort((y, z) => Number(z.timestamp) - Number(y.timestamp)); // Reverse the array to keep the last occurrence of each score
  const finalNicknameObjects: NicknameObject[] = [];

  reversedArr.forEach((n) => {
    if (
      !finalNicknameObjects.find(
        (finalNicknameObject) => finalNicknameObject.account === n.account
      )
    ) {
      finalNicknameObjects.unshift(n); // Add the number to the beginning of the array to keep the last occurrence
    }
  });

  return finalNicknameObjects; // Return the unique scores in their original order
}

export const selectAccountNickname = createSelector(
  [
    (state: RootState) => state.nicknames.nicknameObjects,
    (state: RootState, account: string) => account,
  ],
  (nicknameObjects, account) => {
    if (!nicknameObjects) return undefined;
    return filterOldNicknames(nicknameObjects).find(
      (n) => n.account.toLowerCase() === account.toLowerCase()
    )?.nickname;
  }
);

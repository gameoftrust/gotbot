import {
  GotSpaceChatInfo,
  GotSpaceInvite,
  GotSpaceMember,
} from "../../../types";
import { createSlice } from "@reduxjs/toolkit";
import { getChatInfo } from "./actions";

export type GotSpacesState = {
  spaceChatInfos: GotSpaceChatInfo[];
  spaceInvites: GotSpaceInvite[];
  spaceMembers: GotSpaceMember[];
};

export const initialGotSpacesState: GotSpacesState = {
  spaceChatInfos: [],
  spaceInvites: [],
  spaceMembers: [],
};

export const gotSpacesSlice = createSlice({
  name: "gotSpaces",
  initialState: initialGotSpacesState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getChatInfo.fulfilled, (state, action) => {
      const chatInfo = action.payload;
      state.spaceChatInfos = [...state.spaceChatInfos, chatInfo];
    });
  },
});

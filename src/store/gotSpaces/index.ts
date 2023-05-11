import {
  GotSpaceChatInfo,
  GotSpaceInvite,
  GotSpaceMember,
} from "../../../types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
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
  reducers: {
    setSpaceInvites: (state, action: PayloadAction<GotSpaceInvite[]>) => {
      state.spaceInvites = action.payload;
    },
    setSpaceMembers: (state, action: PayloadAction<GotSpaceMember[]>) => {
      state.spaceMembers = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getChatInfo.fulfilled, (state, action) => {
      const chatInfo = action.payload;
      state.spaceChatInfos = [
        ...state.spaceChatInfos.filter((ci) => ci.id != chatInfo.id),
        chatInfo,
      ];
    });
  },
});

export const { setSpaceInvites, setSpaceMembers } = gotSpacesSlice.actions;

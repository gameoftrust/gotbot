import { createAsyncThunk } from "@reduxjs/toolkit";
import { NicknameObject } from "../../../types";
import { nicknameContract } from "../../web3";

export const fetchNicknames = createAsyncThunk<NicknameObject[]>(
  "nicknames/fetchNicknames",
  async () => {
    const nicknamesArrayLength = Number(
      await nicknameContract.methods.getNicknamesArrayLength().call()
    );
    if (nicknamesArrayLength === 0) return [];
    const nicknamesArray = (await nicknameContract.methods
      .getNicknamesArray(0, nicknamesArrayLength - 1)
      .call()) as any;
    return nicknamesArray.map((nicknameObject: any) => ({
      account: nicknameObject.account,
      nickname: nicknameObject.nickname,
      timestamp: nicknameObject.timestamp,
    }));
  }
);

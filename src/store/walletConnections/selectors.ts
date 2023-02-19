import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";

export const selectWalletConnections = createSelector(
  (state: RootState) => state.walletConnections,
  (walletConnections) => {
    return walletConnections;
  }
);

export const selectAccountHashLastConnection = createSelector(
  (state: RootState) => state.walletConnections,
  (state: RootState, accountHash: string | null | undefined) => accountHash,
  (walletConnections, accountHash) => {
    const connections = walletConnections
      .filter((c) => c.accountHash === accountHash)
      .sort((c1, c2) => c2.timestamp - c1.timestamp);
    return connections.length > 0 ? connections[0] : null;
  }
);

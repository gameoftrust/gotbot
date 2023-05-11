import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { reputationGraphSlice } from "./reputationGraph";
import { nicknamesSlice } from "./nickname";
import { createMigrate, persistReducer, persistStore } from "redux-persist";
import { AsyncNodeStorage } from "redux-persist-node-storage";
import { walletConnectionsSlice } from "./walletConnections";
import { gotSpacesSlice } from "./gotSpaces";
import { MigrationManifest } from "redux-persist/es/types";
import { DEBUG } from "../constants";

if (process.env.REDUX_PERSISTENT_STORAGE_FOLDER === undefined) {
  throw new Error(
    "Please provide the REDUX_PERSISTENT_STORAGE_FOLDER in .env file"
  );
}

const migrations: MigrationManifest = {
  1: (oldState: any) => {
    return {
      ...oldState,
      walletConnections: oldState.walletConnections.map((connection: any) => {
        const { userId, ...rest } = connection;
        return { chatId: userId, ...rest };
      }),
    };
  },
  2: (oldState: any) => {
    return {
      ...oldState,
      walletConnections: [],
    };
  },
};

const persistConfig = {
  key: "root",
  version: 2,
  storage: new AsyncNodeStorage(process.env.REDUX_PERSISTENT_STORAGE_FOLDER),
  migrate: createMigrate(migrations, { debug: DEBUG }),
};

const persistedReducer = persistReducer(
  persistConfig,
  combineReducers({
    gotSpaces: gotSpacesSlice.reducer,
    reputationGraph: reputationGraphSlice.reducer,
    nicknames: nicknamesSlice.reducer,
    walletConnections: walletConnectionsSlice.reducer,
  })
);

// Define the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;

const persistor = persistStore(store);

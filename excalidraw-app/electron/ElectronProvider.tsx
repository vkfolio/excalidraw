import React, { createContext, useContext } from "react";

import type { ElectronAPI } from "./electron.d";

type ElectronContextType = {
  isElectron: boolean;
  electronAPI: ElectronAPI | null;
};

const ElectronContext = createContext<ElectronContextType>({
  isElectron: false,
  electronAPI: null,
});

export const useElectron = (): ElectronContextType =>
  useContext(ElectronContext);

export const isElectron = (): boolean => !!window.electron;

export const getElectronAPI = (): ElectronAPI | null =>
  window.electron ?? null;

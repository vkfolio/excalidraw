import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { isElectron } from "../electron/ElectronProvider";
import { useSetAtom, electronViewAtom } from "../app-jotai";

import { saveDebugState } from "./DebugCanvas";

const _isElectron = isElectron();

const BackIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const PresentIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const PdfIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  onPresent?: () => void;
  onExportPdf?: () => void;
}> = React.memo((props) => {
  const setView = _isElectron
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useSetAtom(electronViewAtom)
    : null;

  return (
    <MainMenu>
      {_isElectron && (
        <MainMenu.Item
          icon={<BackIcon />}
          onSelect={() => setView?.("home")}
        >
          Back to Folders
        </MainMenu.Item>
      )}
      {!_isElectron && <MainMenu.DefaultItems.LoadScene />}
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {_isElectron && (
        <>
          <MainMenu.Item
            icon={<PresentIcon />}
            onSelect={() => props.onPresent?.()}
          >
            Present
          </MainMenu.Item>
          <MainMenu.Item
            icon={<PdfIcon />}
            onSelect={() => props.onExportPdf?.()}
          >
            Export as PDF
          </MainMenu.Item>
        </>
      )}
      {!_isElectron && props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      {!_isElectron && <MainMenu.DefaultItems.Help />}
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      {!_isElectron && (
        <MainMenu.ItemLink
          icon={ExcalLogo}
          href={`${
            import.meta.env.VITE_APP_PLUS_LP
          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
          className=""
        >
          Excalidraw+
        </MainMenu.ItemLink>
      )}
      {!_isElectron && <MainMenu.DefaultItems.Socials />}
      {!_isElectron && (
        <MainMenu.ItemLink
          icon={loginIcon}
          href={`${import.meta.env.VITE_APP_PLUS_APP}${
            isExcalidrawPlusSignedUser ? "" : "/sign-up"
          }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
          className="highlighted"
        >
          {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
        </MainMenu.ItemLink>
      )}
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onClick={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});

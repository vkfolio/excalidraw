import { atom } from "../app-jotai";

export const currentPathAtom = atom<string>("");
export const viewModeAtom = atom<"grid" | "list">("grid");
export const searchQueryAtom = atom<string>("");
export const sortByAtom = atom<"name" | "date">("name");

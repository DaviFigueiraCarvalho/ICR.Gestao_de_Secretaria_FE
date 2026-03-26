import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isPermissionError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes(NOT_ADMIN_ERR_MSG) || error.message.includes("10002");
  }
  return false;
};

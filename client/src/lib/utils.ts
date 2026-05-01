import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isPermissionError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const status = (error as Error & { status?: number }).status;

    return (
      status === 403 ||
      message.includes(NOT_ADMIN_ERR_MSG.toLowerCase()) ||
      message.includes('10002') ||
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('acesso negado') ||
      message.includes('sem permissão') ||
      message.includes('sem permissao')
    );
  }
  return false;
};

export const settledValue = <T>(result: PromiseSettledResult<T>): T | undefined => {
  if (result.status === 'fulfilled') return result.value;
  return undefined;
};

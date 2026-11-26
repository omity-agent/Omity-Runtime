import { hasErrorCode } from "../failures/thrownValues";

export function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ESRCH")) {
      return false;
    }
    if (hasErrorCode(error, "EPERM")) {
      return true;
    }
    throw error;
  }
}

import { invoke } from "@tauri-apps/api";
import { EJSON } from "bson";

export async function executeScript({
  script,
  clientId,
  dbName,
}: {
  script: string;
  clientId: string;
  dbName: string;
}) {
  const res: Record<any, any> = await invoke("exec_script", {
    clientId,
    dbName,
    script,
  });
  const parsed = EJSON.deserialize(res);
  return parsed;
}

import path from "path";
import os from "os";

export const HOME_DIR = os.homedir();
export const SETTING_DIR = path.join(HOME_DIR, ".config", "clara");

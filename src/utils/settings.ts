import path from "path";
import { file } from "bun";
import fs from "fs/promises";
import { SETTING_DIR } from "../../constants";
import { z } from "zod";

const settingSchema = z.object({
  mcpServers: z.record(
    z.object({
      type: z.literal("stdio"),
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string()),
    }),
  ),
});

export type Settings = z.infer<typeof settingSchema>;

// Default settings with empty mcpServers
const defaultSettings: Settings = {
  mcpServers: {},
};

export async function getSettings() {
  const settingsPath = path.join(SETTING_DIR, "settings.json");
  
  // Check if settings file exists
  try {
    await fs.access(settingsPath);
  } catch (error) {
    console.log(`Settings file not found at ${settingsPath}, using default settings`);
    return defaultSettings;
  }

  try {
    const settingFile = file(settingsPath);
    const settingsData = await settingFile.json();
    const validatedSettings = settingSchema.safeParse(settingsData);
    
    if (!validatedSettings.success) {
      console.error("Invalid settings file format, using default settings");
      return defaultSettings;
    }
    
    return validatedSettings.data;
  } catch (error) {
    console.error(`Error reading settings file: ${error instanceof Error ? error.message : error}`);
    return defaultSettings;
  }
}

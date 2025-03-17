import path from "path";
import { file } from "bun";
import fs from "fs/promises";
import { SETTING_DIR } from "../../constants";
import { z } from "zod";

// Features configuration schema
const featuresSchema = z.object({
  multiAgentSystem: z.boolean().default(false),
  memoryIndexing: z.boolean().default(false),
  agentActivity: z.boolean().default(true),
  contextSharing: z.boolean().default(true),
}).optional().default({
  multiAgentSystem: false,
  memoryIndexing: false,
  agentActivity: true,
  contextSharing: true,
});

const settingSchema = z.object({
  mcpServers: z.record(
    z.object({
      type: z.literal("stdio"),
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string()),
    }),
  ),
  features: featuresSchema,
});

export type Settings = z.infer<typeof settingSchema>;

// Default settings
const defaultSettings: Settings = {
  mcpServers: {},
  features: {
    multiAgentSystem: true, // Now enabled by default
    memoryIndexing: false,
    agentActivity: true,
    contextSharing: true,
  },
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
    
    // Merge with defaults to ensure all properties exist
    const mergedSettings = {
      ...defaultSettings,
      ...validatedSettings.data,
      features: {
        ...defaultSettings.features,
        ...validatedSettings.data.features,
      },
    };
    
    return mergedSettings;
  } catch (error) {
    console.error(`Error reading settings file: ${error instanceof Error ? error.message : error}`);
    return defaultSettings;
  }
}

/**
 * Update specific settings
 */
export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const settingsPath = path.join(SETTING_DIR, "settings.json");
  const currentSettings = await getSettings();
  
  // Merge current settings with updates
  const updatedSettings = {
    ...currentSettings,
    ...settings,
    features: {
      ...defaultSettings.features,
      ...(currentSettings.features || {}),
      ...(settings.features || {}),
    },
  };
  
  // Ensure settings directory exists
  try {
    await fs.mkdir(SETTING_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error creating settings directory: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
  
  // Write updated settings
  try {
    await fs.writeFile(settingsPath, JSON.stringify(updatedSettings, null, 2));
    return updatedSettings;
  } catch (error) {
    console.error(`Error writing settings file: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

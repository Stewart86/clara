import path from "path";
import { file } from "bun";
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

export async function getSettings() {
  const settingFile = file(path.join(SETTING_DIR, "settings.json"));
  const validatedSettings = settingSchema.safeParse(await settingFile.json());
  if (!validatedSettings.success) {
    throw new Error("Invalid settings file");
  }
  return validatedSettings.data;
}

import type { FullConfig } from "@playwright/test";
import { setDeskV2 } from "./global-setup";

export default async function globalTeardown(config: FullConfig): Promise<void> {
	await setDeskV2(config.projects[0]?.use.baseURL as string, 0);
}

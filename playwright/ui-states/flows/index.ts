import type { AnyFlow } from "../flow";
import { designNew } from "./designNew";

/** Canvas order: the flows of the ticket, top to bottom. */
export const flows: AnyFlow[] = [designNew];

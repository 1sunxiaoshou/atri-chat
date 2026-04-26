import { ParsedAction, parseActionCommands } from '@/utils/actionCommands';

export interface StreamAdapterResult {
  commands: ParsedAction[];
  rejected: string[];
}

export function adaptActionCommands(commands: string[]): StreamAdapterResult {
  return parseActionCommands(commands);
}

export type ParsedAction =
  | { type: 'emotion'; value: string }
  | { type: 'motion'; value: string }
  | { type: 'say'; emotion: string; text: string }
  | { type: 'wait'; ms: number };

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

export function parseActionCommand(command: string): ParsedAction | null {
  const normalized = normalizeWhitespace(command);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('emotion ')) {
    const value = normalized.slice('emotion '.length).trim();
    return value ? { type: 'emotion', value } : null;
  }

  if (normalized.startsWith('motion ')) {
    const value = normalized.slice('motion '.length).trim();
    return value ? { type: 'motion', value } : null;
  }

  if (normalized.startsWith('wait ')) {
    const rawMs = normalized.slice('wait '.length).trim();
    const ms = Number(rawMs);
    if (!Number.isFinite(ms) || ms < 0) {
      return null;
    }
    return { type: 'wait', ms };
  }

  if (normalized.startsWith('say ')) {
    const payload = normalized.slice('say '.length);
    const separatorIndex = payload.indexOf('|');
    if (separatorIndex < 0) {
      return null;
    }

    const emotion = payload.slice(0, separatorIndex).trim();
    const text = payload.slice(separatorIndex + 1).trim();
    if (!emotion || !text) {
      return null;
    }

    return {
      type: 'say',
      emotion,
      text,
    };
  }

  return null;
}

export function parseActionCommands(commands: string[]): { commands: ParsedAction[]; rejected: string[] } {
  const parsed: ParsedAction[] = [];
  const rejected: string[] = [];

  for (const command of commands) {
    const result = parseActionCommand(command);
    if (result) {
      parsed.push(result);
    } else {
      rejected.push(command);
    }
  }

  return { commands: parsed, rejected };
}

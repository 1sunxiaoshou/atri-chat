import { parseActionCommand, parseActionCommands } from '../utils/actionCommands';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const sayCommand = parseActionCommand('say happy | 欢迎回来');
assert(sayCommand?.type === 'say', 'say command should parse');

const motionCommand = parseActionCommand('motion wave');
assert(motionCommand?.type === 'motion', 'motion command should parse');

const waitCommand = parseActionCommand('wait 600');
assert(waitCommand?.type === 'wait' && waitCommand.ms === 600, 'wait command should parse');

const invalidCommand = parseActionCommand('camera close');
assert(invalidCommand === null, 'invalid command should be rejected');

const batch = parseActionCommands([
  'emotion happy',
  'say happy | 你好呀',
  'wait 300',
  'invalid',
]);

assert(batch.commands.length === 3, 'three valid commands should remain');
assert(batch.rejected.length === 1, 'one invalid command should be rejected');

console.log('action command parser check passed');

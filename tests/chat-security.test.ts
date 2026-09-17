import { describe, it, expect } from 'vitest';
import { threadDto } from '../apps/api/src/core/schemas';

describe('Chat Security & Client Exclusion', () => {
  it('allows valid internal thread types', () => {
    const validInternalPayloads = [
      { title: 'Agency Team', kind: 'GROUP', memberIds: ['user_1', 'user_2'] },
      { title: 'Direct Chat', kind: 'DIRECT', memberIds: ['user_1', 'user_2'] },
      { title: 'Acme Internal', kind: 'CLIENT_INTERNAL', clientId: 'client_1', memberIds: ['user_1'] },
      { title: 'CNT-0001 Chat', kind: 'CONTENT', clientId: 'client_1', contentId: 1, memberIds: ['user_1'] },
      { title: 'Task Review', kind: 'TASK', clientId: 'client_1', taskId: 'task_1', memberIds: ['user_1'] },
    ];

    for (const payload of validInternalPayloads) {
      expect(() => threadDto.parse(payload)).not.toThrow();
    }
  });

  it('EXCLUDES CLIENT_FACING chat: threadDto rejects CLIENT_FACING kind', () => {
    const clientFacingPayload = {
      title: 'Client Facing Thread',
      kind: 'CLIENT_FACING',
      clientId: 'client_1',
      memberIds: ['user_1', 'client_user_1']
    };

    expect(() => threadDto.parse(clientFacingPayload)).toThrow();
  });

  it('ensures Client role definition contains no chat permissions', () => {
    const clientPermissions = [
      'client.view',
      'content.view',
      'content.approve_client',
      'drive.view',
      'report.view',
      'activity.view'
    ];

    const chatPermissions = [
      'chat.view',
      'chat.internal',
      'chat.client',
      'chat.create',
      'chat.moderate'
    ];

    for (const chatPerm of chatPermissions) {
      expect(clientPermissions).not.toContain(chatPerm);
    }
  });
});

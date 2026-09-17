import { describe, it, expect } from 'vitest';
import {
  assertAssignment,
  suggestDeadlines,
  validateDriveUrl,
  clientStatus,
  allowedActions,
  nextInternalStage
} from '../apps/api/src/core/workflow';
import { offsets } from '../apps/api/src/core/types';

describe('Workflow & Security Engine', () => {
  describe('Task Assignment Security Rules', () => {
    it('allows Super Admin to assign tasks to anyone including Super Admin', () => {
      const superAdmin = { isSuperAdmin: true, isClient: false };
      const employee = { isSuperAdmin: false, isClient: false };

      expect(() => assertAssignment(superAdmin, superAdmin)).not.toThrow();
      expect(() => assertAssignment(superAdmin, employee)).not.toThrow();
    });

    it('allows internal user to assign tasks to permitted internal user', () => {
      const internalCreator = { isSuperAdmin: false, isClient: false };
      const internalAssignee = { isSuperAdmin: false, isClient: false };

      expect(() => assertAssignment(internalCreator, internalAssignee)).not.toThrow();
    });

    it('BLOCKS non-Super Admin from assigning tasks to Super Admin', () => {
      const internalCreator = { isSuperAdmin: false, isClient: false };
      const superAdminAssignee = { isSuperAdmin: true, isClient: false };

      expect(() => assertAssignment(internalCreator, superAdminAssignee)).toThrowError(
        'Only a Super Admin can assign tasks to a Super Admin.'
      );
    });

    it('BLOCKS clients from assigning internal tasks', () => {
      const client = { isSuperAdmin: false, isClient: true };
      const employee = { isSuperAdmin: false, isClient: false };

      expect(() => assertAssignment(client, employee)).toThrowError(
        'Clients cannot assign internal tasks.'
      );
    });

    it('BLOCKS internal tasks from being assigned to clients', () => {
      const superAdmin = { isSuperAdmin: true, isClient: false };
      const client = { isSuperAdmin: false, isClient: true };

      expect(() => assertAssignment(superAdmin, client)).toThrowError(
        'Internal tasks cannot be assigned to a client.'
      );
    });
  });

  describe('Deadline Calculation Engine', () => {
    it('calculates suggested deadlines backwards from publish date', () => {
      const publishAt = new Date('2026-09-25T12:00:00.000Z');
      const calculated = suggestDeadlines(publishAt, offsets);

      // Script: -8 days = 17 Sep
      expect(calculated.script.startsWith('2026-09-17')).toBe(true);
      // Client Script Approval: -7 days = 18 Sep
      expect(calculated.clientScript.startsWith('2026-09-18')).toBe(true);
      // Shoot: -5 days = 20 Sep
      expect(calculated.shoot.startsWith('2026-09-20')).toBe(true);
      // First Edit: -3 days = 22 Sep
      expect(calculated.edit.startsWith('2026-09-22')).toBe(true);
      // Client Final Approval: -2 days = 23 Sep
      expect(calculated.clientFinal.startsWith('2026-09-23')).toBe(true);
      // Ready to Publish: -1 day = 24 Sep
      expect(calculated.ready.startsWith('2026-09-24')).toBe(true);
    });
  });

  describe('Google Drive URL Validation', () => {
    it('accepts valid drive.google.com and docs.google.com URLs', () => {
      expect(validateDriveUrl('https://drive.google.com/drive/folders/123456')).toBe(true);
      expect(validateDriveUrl('https://docs.google.com/document/d/abc-xyz/edit')).toBe(true);
    });

    it('rejects non-Google Drive URLs and unencrypted schemes', () => {
      expect(validateDriveUrl('http://drive.google.com/test')).toBe(false);
      expect(validateDriveUrl('https://malicious-site.com/drive.google.com')).toBe(false);
      expect(validateDriveUrl('https://user:pass@drive.google.com/test')).toBe(false);
      expect(validateDriveUrl('javascript:alert(1)')).toBe(false);
      expect(validateDriveUrl('not-a-url')).toBe(false);
    });
  });

  describe('Client Status Sanitization', () => {
    it('masks internal production stages into client-friendly labels', () => {
      expect(clientStatus('INTERNAL_SCRIPT_REVIEW')).toBe('PREPARING_SCRIPT');
      expect(clientStatus('SCRIPT_WRITING')).toBe('PREPARING_SCRIPT');
      expect(clientStatus('INTERNAL_EDIT_REVIEW')).toBe('IN_PRODUCTION');
      expect(clientStatus('EDITING')).toBe('IN_PRODUCTION');
      expect(clientStatus('RAW_FOOTAGE_READY')).toBe('IN_PRODUCTION');
      expect(clientStatus('SHOOT_COMPLETED')).toBe('IN_PRODUCTION');
      expect(clientStatus('INTERNAL_CHANGES')).toBe('IN_PRODUCTION');
      expect(clientStatus('INTERNAL_APPROVED')).toBe('IN_PRODUCTION');
    });

    it('retains client-facing milestones unchanged', () => {
      expect(clientStatus('CLIENT_REVIEW')).toBe('CLIENT_REVIEW');
      expect(clientStatus('CLIENT_CHANGES')).toBe('CLIENT_CHANGES');
      expect(clientStatus('FINAL_CLIENT_APPROVED')).toBe('FINAL_CLIENT_APPROVED');
      expect(clientStatus('PUBLISHED')).toBe('PUBLISHED');
    });
  });

  describe('Workflow Progression & Actions', () => {
    it('maps allowed actions per workflow stage', () => {
      expect(allowedActions('PLANNING')).toEqual(['START_SCRIPT']);
      expect(allowedActions('SCRIPT_WRITING')).toEqual(['SUBMIT_SCRIPT']);
      expect(allowedActions('INTERNAL_SCRIPT_REVIEW')).toEqual(['APPROVE', 'REQUEST_CHANGES']);
      expect(allowedActions('SCRIPT_APPROVED')).toEqual(['START_PRODUCTION']);
      expect(allowedActions('READY_TO_PUBLISH')).toEqual(['SCHEDULE_PUBLISH', 'PUBLISH']);
      expect(allowedActions('PUBLISHED')).toEqual(['ANALYTICS']);
    });

    it('calculates next internal approval tier based on rules', () => {
      const smmOnly = { smm: true, admin: false, superAdmin: false, client: true };
      expect(nextInternalStage('SMM', smmOnly)).toBe('CLIENT');

      const adminRequired = { smm: true, admin: true, superAdmin: false, client: true };
      expect(nextInternalStage('SMM', adminRequired)).toBe('ADMIN');

      const superAdminRequired = { smm: true, admin: false, superAdmin: true, client: true };
      expect(nextInternalStage('SMM', superAdminRequired)).toBe('SUPER_ADMIN');
    });
  });
});

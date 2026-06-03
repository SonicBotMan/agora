/**
 * Settings — Cowork Agent Tab
 *
 * Three files that govern the cowork agent's identity, soul, and user
 * profile (IDENTITY.md / SOUL.md / USER.md). The values are bound to
 * parent-owned state so save/cancel restores the original values via
 * the parent reducer.
 */

import React from 'react';

import { i18nService } from '../../../services/i18n';
import type { CoworkConfig } from '../../../types/cowork';
import { joinWorkspacePath } from '../utils';

export interface CoworkAgentTabProps {
  coworkConfig: CoworkConfig;
  bootstrapIdentity: string;
  setBootstrapIdentity: React.Dispatch<React.SetStateAction<string>>;
  bootstrapSoul: string;
  setBootstrapSoul: React.Dispatch<React.SetStateAction<string>>;
  bootstrapUser: string;
  setBootstrapUser: React.Dispatch<React.SetStateAction<string>>;
}

interface FileEditorDescriptor {
  filename: string;
  titleKey: string;
  hintKey: string;
  value: string;
  setter: React.Dispatch<React.SetStateAction<string>>;
}

export const CoworkAgentTab: React.FC<CoworkAgentTabProps> = ({
  coworkConfig,
  bootstrapIdentity,
  setBootstrapIdentity,
  bootstrapSoul,
  setBootstrapSoul,
  bootstrapUser,
  setBootstrapUser,
}) => {
  const fileEditors: FileEditorDescriptor[] = [
    {
      filename: 'IDENTITY.md',
      titleKey: 'coworkBootstrapIdentityTitle',
      hintKey: 'coworkBootstrapIdentityHint',
      value: bootstrapIdentity,
      setter: setBootstrapIdentity,
    },
    {
      filename: 'SOUL.md',
      titleKey: 'coworkBootstrapSoulTitle',
      hintKey: 'coworkBootstrapSoulHint',
      value: bootstrapSoul,
      setter: setBootstrapSoul,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Agent Settings (IDENTITY.md + SOUL.md) */}
      <div className="space-y-4 rounded-xl border px-4 py-4 border-border">
        <div className="text-sm font-medium text-foreground">
          {i18nService.t('coworkBootstrapAgentSectionTitle')}
        </div>
        {fileEditors.map(({ filename, titleKey, hintKey, value, setter }) => (
          <div key={filename} className="space-y-2">
            <div className="text-xs font-medium text-secondary">
              {i18nService.t(titleKey)}
              <span className="ml-1.5 font-normal opacity-60">
                （{i18nService.t('coworkBootstrapStoragePath')}：
                <span className="font-mono">
                  {joinWorkspacePath(coworkConfig.workingDirectory, filename)}
                </span>
                ）
              </span>
            </div>
            <textarea
              value={value}
              onChange={(e) => setter(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground resize-y"
              placeholder={i18nService.t(hintKey)}
            />
          </div>
        ))}
      </div>

      {/* User Profile (USER.md) */}
      <div className="space-y-3 rounded-xl border px-4 py-4 border-border">
        <div className="text-sm font-medium text-foreground">
          {i18nService.t('coworkBootstrapUserTitle')}
          <span className="ml-1.5 text-xs font-normal opacity-60 text-secondary">
            （{i18nService.t('coworkBootstrapStoragePath')}：
            <span className="font-mono">
              {joinWorkspacePath(coworkConfig.workingDirectory, 'USER.md')}
            </span>
            ）
          </span>
        </div>
        <textarea
          value={bootstrapUser}
          onChange={(e) => setBootstrapUser(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground resize-y"
          placeholder={i18nService.t('coworkBootstrapUserHint')}
        />
      </div>
    </div>
  );
};

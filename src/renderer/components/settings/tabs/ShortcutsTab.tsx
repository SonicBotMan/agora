/**
 * Settings — Keyboard Shortcuts Tab
 *
 * Single-column list of three key bindings: new chat, search, open settings.
 * The bound values are passed in by the parent so that the parent remains
 * the source of truth for the global shortcut store.
 */

import React from 'react';

import { i18nService } from '../../../services/i18n';
import ShortcutRecorder from '../ShortcutRecorder';

export type ShortcutKey = 'newChat' | 'search' | 'settings';

export interface ShortcutsTabProps {
  /** Current shortcut strings (e.g. "Cmd+N") keyed by action. */
  shortcuts: Record<ShortcutKey, string>;
  /** Update handler invoked with the key + new value. */
  onShortcutChange: (key: ShortcutKey, value: string) => void;
}

export const ShortcutsTab: React.FC<ShortcutsTabProps> = ({ shortcuts, onShortcutChange }) => {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          {i18nService.t('keyboardShortcuts')}
        </label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{i18nService.t('newChat')}</span>
            <ShortcutRecorder
              value={shortcuts.newChat}
              onChange={(v) => onShortcutChange('newChat', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{i18nService.t('search')}</span>
            <ShortcutRecorder
              value={shortcuts.search}
              onChange={(v) => onShortcutChange('search', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{i18nService.t('openSettings')}</span>
            <ShortcutRecorder
              value={shortcuts.settings}
              onChange={(v) => onShortcutChange('settings', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Settings — Cowork Memory Tab
 *
 * Two-section tab:
 *   1) Long-term memory file path (MEMORY.md) — read-only display.
 *   2) Memory CRUD: search, list, edit, delete entries backed by the
 *      cowork memory store; "Create" opens a parent-owned modal via
 *      `handleOpenCoworkMemoryModal`.
 *
 * All state, stats, and handlers are passed in from the parent so this
 * component remains a pure renderer. The parent owns the underlying
 * memory cache + redux dispatch lifecycle.
 */

import { PlusCircleIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../../services/i18n';
import type {
  CoworkConfig,
  CoworkMemoryStats,
  CoworkUserMemoryEntry,
} from '../../../types/cowork';
import { joinWorkspacePath } from '../utils';

export interface CoworkMemoryTabProps {
  coworkConfig: CoworkConfig;
  coworkMemoryStats: CoworkMemoryStats | null;
  coworkMemoryQuery: string;
  setCoworkMemoryQuery: React.Dispatch<React.SetStateAction<string>>;
  coworkMemoryEntries: CoworkUserMemoryEntry[];
  coworkMemoryListLoading: boolean;
  handleOpenCoworkMemoryModal: () => void;
  handleEditCoworkMemoryEntry: (entry: CoworkUserMemoryEntry) => void;
  handleDeleteCoworkMemoryEntry: (entry: CoworkUserMemoryEntry) => Promise<void>;
}

export const CoworkMemoryTab: React.FC<CoworkMemoryTabProps> = ({
  coworkConfig,
  coworkMemoryStats,
  coworkMemoryQuery,
  setCoworkMemoryQuery,
  coworkMemoryEntries,
  coworkMemoryListLoading,
  handleOpenCoworkMemoryModal,
  handleEditCoworkMemoryEntry,
  handleDeleteCoworkMemoryEntry,
}) => {
  return (
    <div className="space-y-6">
      {/* Section 1: Long-term Memory (MEMORY.md) */}
      <div className="space-y-3 rounded-xl border px-4 py-4 border-border">
        <div className="text-sm font-medium text-foreground">
          {i18nService.t('coworkMemoryTitle')}
        </div>
        {/* Memory toggle hidden – always enabled by default */}
        <div className="mt-2 text-xs text-secondary">
          <span className="font-medium">{i18nService.t('coworkMemoryFilePath')}:</span>{' '}
          <span className="break-all font-mono opacity-80">
            {joinWorkspacePath(coworkConfig.workingDirectory, 'MEMORY.md')}
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border px-4 py-4 border-border">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              {i18nService.t('coworkMemoryCrudTitle')}
            </div>
            <div className="text-xs text-secondary">
              {i18nService.t('coworkMemoryManageHint')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenCoworkMemoryModal}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm transition-colors active:scale-[0.98]"
          >
            <PlusCircleIcon className="h-4 w-4 mr-1.5" />
            {i18nService.t('coworkMemoryCrudCreate')}
          </button>
        </div>

        {coworkMemoryStats && (
          <div className="text-xs text-secondary">
            {`${i18nService.t('coworkMemoryTotalLabel')}: ${coworkMemoryStats.total}`}
          </div>
        )}

        <input
          type="text"
          value={coworkMemoryQuery}
          onChange={(event) => setCoworkMemoryQuery(event.target.value)}
          placeholder={i18nService.t('coworkMemorySearchPlaceholder')}
          className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface"
        />

        <div className="rounded-lg border border-border">
          {coworkMemoryListLoading ? (
            <div className="px-3 py-3 text-xs text-secondary">
              {i18nService.t('loading')}
            </div>
          ) : coworkMemoryEntries.length === 0 ? (
            <div className="px-3 py-3 text-xs text-secondary">
              {i18nService.t('coworkMemoryEmpty')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {coworkMemoryEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-3 text-xs hover:bg-surface-raised transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground break-words">
                        {entry.text}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditCoworkMemoryEntry(entry)}
                        className="rounded border px-2 py-1 border-border text-foreground hover:bg-surface-raised transition-colors"
                      >
                        {i18nService.t('edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteCoworkMemoryEntry(entry);
                        }}
                        className="rounded border px-2 py-1 text-red-500 border-border hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
                        disabled={coworkMemoryListLoading}
                      >
                        {i18nService.t('delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

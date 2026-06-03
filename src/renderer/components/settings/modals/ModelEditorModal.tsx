/**
 * Settings — Model Editor Modal
 *
 * Inline overlay for creating or editing a model in the model tab.
 * Two flows share the same dialog:
 *
 *   - Ollama: only "model id" and "display name" are asked (the
 *     display name auto-syncs to the id while empty).
 *   - All other providers: "model name" (display), "model id",
 *     and an optional "supports image input" checkbox.
 *
 * The form is fully controlled — the parent owns all input state so
 * the save / cancel buttons at the bottom of the Settings dialog
 * can revert the snapshot.
 *
 * Submit / cancel handlers are passed in by the parent. The modal
 * itself only handles Enter / Escape via `onKeyDown` so the parent
 * can keep keyboard logic in one place.
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../../services/i18n';

export interface ModelEditorModalProps {
  // Title / mode
  isEditing: boolean;

  // Form state
  newModelId: string;
  setNewModelId: React.Dispatch<React.SetStateAction<string>>;
  newModelName: string;
  setNewModelName: React.Dispatch<React.SetStateAction<string>>;
  newModelSupportsImage: boolean;
  setNewModelSupportsImage: React.Dispatch<React.SetStateAction<boolean>>;
  modelFormError: string | null;
  setModelFormError: React.Dispatch<React.SetStateAction<string | null>>;

  // Branch flag
  isOllama: boolean;

  // Handlers
  onCancel: () => void;
  onSave: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export const ModelEditorModal: React.FC<ModelEditorModalProps> = ({
  isEditing,
  newModelId,
  setNewModelId,
  newModelName,
  setNewModelName,
  newModelSupportsImage,
  setNewModelSupportsImage,
  modelFormError,
  setModelFormError,
  isOllama,
  onCancel,
  onSave,
  onKeyDown,
}) => {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? i18nService.t('editModel') : i18nService.t('addNewModel')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-2xl bg-background border-border border shadow-modal p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            {isEditing ? i18nService.t('editModel') : i18nService.t('addNewModel')}
          </h4>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-secondary hover:text-foreground rounded-md hover:bg-surface-raised"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {modelFormError && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">
            {modelFormError}
          </p>
        )}

        <div className="space-y-3">
          {isOllama ? (
            <>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {i18nService.t('ollamaModelName')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newModelId}
                  onChange={(e) => {
                    setNewModelId(e.target.value);
                    if (!newModelName || newModelName === newModelId) {
                      setNewModelName(e.target.value);
                    }
                    if (modelFormError) {
                      setModelFormError(null);
                    }
                  }}
                  className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                  placeholder={i18nService.t('ollamaModelNamePlaceholder')}
                />
                <p className="mt-1 text-[11px] text-muted">
                  {i18nService.t('ollamaModelNameHint')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {i18nService.t('ollamaDisplayName')}
                </label>
                <input
                  type="text"
                  value={newModelName === newModelId ? '' : newModelName}
                  onChange={(e) => {
                    setNewModelName(e.target.value || newModelId);
                    if (modelFormError) {
                      setModelFormError(null);
                    }
                  }}
                  className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                  placeholder={i18nService.t('ollamaDisplayNamePlaceholder')}
                />
                <p className="mt-1 text-[11px] text-muted">
                  {i18nService.t('ollamaDisplayNameHint')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {i18nService.t('modelName')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newModelName}
                  onChange={(e) => {
                    setNewModelName(e.target.value);
                    if (modelFormError) {
                      setModelFormError(null);
                    }
                  }}
                  className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                  placeholder="GPT-4"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {i18nService.t('modelId')}
                </label>
                <input
                  type="text"
                  value={newModelId}
                  onChange={(e) => {
                    setNewModelId(e.target.value);
                    if (modelFormError) {
                      setModelFormError(null);
                    }
                  }}
                  className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                  placeholder="gpt-4"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModelSupportsImage}
                    onChange={(e) => setNewModelSupportsImage(e.target.checked)}
                    className="rounded border-border"
                  />
                  {i18nService.t('supportsImageInput')}
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised rounded-xl border border-border"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 text-xs text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98]"
          >
            {i18nService.t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

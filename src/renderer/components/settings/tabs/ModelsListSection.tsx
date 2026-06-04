/**
 * Settings — Model Tab · Models List Section
 *
 * Renders the per-provider list of available models. Each row shows
 * the model name, its underlying id, an "Image input" badge if it
 * supports image input, and two hover-revealed edit/delete buttons.
 *
 * If the provider has no models at all, an empty-state card invites
 * the user to add their first model. The parent owns the model
 * data and the edit/delete handlers; this component is a pure
 * renderer.
 */

import { PencilIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../../services/i18n';

/** A single model entry as it appears in `providers[X].models`. */
export interface ModelEntry {
  id: string;
  name: string;
  supportsImage?: boolean;
}

export interface ModelsListSectionProps {
  /** All models configured for the selected provider. */
  models: ModelEntry[] | undefined;
  /** Open the model-editor modal in "add" mode. */
  onAddModel: () => void;
  /** Open the model-editor modal in "edit" mode for the given model. */
  onEditModel: (model: ModelEntry) => void;
  /** Remove the model with the given id. */
  onDeleteModel: (modelId: string) => void;
}

export const ModelsListSection: React.FC<ModelsListSectionProps> = ({
  models,
  onAddModel,
  onEditModel,
  onDeleteModel,
}) => {
  const list = models ?? [];

  return (
    <div className="space-y-1.5 max-h-60 overflow-y-auto">
      {list.length > 0 &&
        list.map((model) => (
          <div
            key={model.id}
            className="bg-surface p-2 rounded-xl border-border border transition-colors hover:border-primary group"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-green-400"></div>
                <div className="min-w-0">
                  <div className="text-foreground font-medium text-[11px] truncate">
                    {model.name}
                  </div>
                  <div className="text-[10px] text-secondary truncate">
                    {model.id}
                  </div>
                </div>
              </div>
              <div className="flex items-center shrink-0 space-x-1">
                {model.supportsImage && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-muted text-primary">
                    {i18nService.t('imageInput')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEditModel(model)}
                  className="p-0.5 text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteModel(model.id)}
                  className="p-0.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

      {list.length === 0 && (
        <div className="bg-surface p-2.5 rounded-xl border border-border-subtle text-center">
          <p className="text-[11px] text-secondary">
            {i18nService.t('noModelsAvailable')}
          </p>
          <button
            type="button"
            onClick={onAddModel}
            className="mt-1.5 inline-flex items-center text-[11px] font-medium text-primary hover:text-primary-hover"
          >
            <PlusCircleIcon className="h-3 w-3 mr-1" />
            {i18nService.t('addFirstModel')}
          </button>
        </div>
      )}
    </div>
  );
};

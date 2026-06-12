import React, { useCallback, useState } from 'react';

import { i18nService } from '../../../services/i18n';
import type { ProvidersConfig,ProviderType } from '../providerConfigUtils';

export interface UseModelEditorArgs {
  providers: ProvidersConfig;
  setProviders: React.Dispatch<React.SetStateAction<ProvidersConfig>>;
  activeProvider: ProviderType;
}

export interface UseModelEditorResult {
  isAddingModel: boolean;
  isEditingModel: boolean;
  editingModelId: string | null;
  newModelName: string;
  setNewModelName: React.Dispatch<React.SetStateAction<string>>;
  newModelId: string;
  setNewModelId: React.Dispatch<React.SetStateAction<string>>;
  newModelSupportsImage: boolean;
  setNewModelSupportsImage: React.Dispatch<React.SetStateAction<boolean>>;
  modelFormError: string | null;
  setModelFormError: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddModel: () => void;
  handleEditModel: (modelId: string, modelName: string, supportsImage?: boolean) => void;
  handleDeleteModel: (modelId: string) => void;
  handleSaveNewModel: () => void;
  handleCancelModelEdit: () => void;
  handleModelDialogKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export const useModelEditor = ({
  providers,
  setProviders,
  activeProvider,
}: UseModelEditorArgs): UseModelEditorResult => {
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelSupportsImage, setNewModelSupportsImage] = useState(false);
  const [modelFormError, setModelFormError] = useState<string | null>(null);

  const handleAddModel = useCallback(() => {
    setIsAddingModel(true);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  }, []);

  const handleEditModel = useCallback((
    modelId: string,
    modelName: string,
    supportsImage?: boolean,
  ) => {
    setIsAddingModel(false);
    setIsEditingModel(true);
    setEditingModelId(modelId);
    setNewModelName(modelName);
    setNewModelId(modelId);
    setNewModelSupportsImage(!!supportsImage);
    setModelFormError(null);
  }, []);

  const handleDeleteModel = useCallback((modelId: string) => {
    if (!providers[activeProvider].models) return;

    const updatedModels = providers[activeProvider].models.filter(
      (model) => model.id !== modelId,
    );

    setProviders((prev) => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels,
      },
    }));
  }, [activeProvider, providers, setProviders]);

  const handleSaveNewModel = useCallback(() => {
    const modelId = newModelId.trim();

    if (activeProvider === 'ollama') {
      // For Ollama, only the model name (stored as modelId) is required
      if (!modelId) {
        setModelFormError(i18nService.t('ollamaModelNameRequired'));
        return;
      }
    } else {
      const modelName = newModelName.trim();
      if (!modelName || !modelId) {
        setModelFormError(i18nService.t('modelNameAndIdRequired'));
        return;
      }
    }

    // For Ollama, auto-fill display name from modelId if not provided
    const modelName = activeProvider === 'ollama'
      ? (newModelName.trim() && newModelName.trim() !== modelId ? newModelName.trim() : modelId)
      : newModelName.trim();

    const currentModels = providers[activeProvider].models ?? [];
    const duplicateModel = currentModels.find(
      (model) => model.id === modelId && (!isEditingModel || model.id !== editingModelId),
    );
    if (duplicateModel) {
      setModelFormError(i18nService.t('modelIdExists'));
      return;
    }

    const nextModel = {
      id: modelId,
      name: modelName,
      supportsImage: newModelSupportsImage,
    };
    const updatedModels = isEditingModel && editingModelId
      ? currentModels.map((model) => (model.id === editingModelId ? nextModel : model))
      : [...currentModels, nextModel];

    setProviders((prev) => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels,
      },
    }));

    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  }, [
    activeProvider,
    editingModelId,
    isEditingModel,
    newModelId,
    newModelName,
    newModelSupportsImage,
    providers,
    setProviders,
  ]);

  const handleCancelModelEdit = useCallback(() => {
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  }, []);

  const handleModelDialogKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelModelEdit();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveNewModel();
      }
    },
    [handleCancelModelEdit, handleSaveNewModel],
  );

  return {
    isAddingModel,
    isEditingModel,
    editingModelId,
    newModelName,
    setNewModelName,
    newModelId,
    setNewModelId,
    newModelSupportsImage,
    setNewModelSupportsImage,
    modelFormError,
    setModelFormError,
    handleAddModel,
    handleEditModel,
    handleDeleteModel,
    handleSaveNewModel,
    handleCancelModelEdit,
    handleModelDialogKeyDown,
  };
};

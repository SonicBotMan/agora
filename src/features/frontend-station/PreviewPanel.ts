/**
 * PreviewPanel — preview panel management.
 *
 * Skeleton implementation for iframe / webview-based preview of running
 * dev servers. Actual renderer integration (Electron BrowserView / webview
 * tag) should be wired by the consuming layer.
 */

import type { PreviewState } from './types';

// ── Panel Manager ───────────────────────────────────────────────────────────

export class PreviewPanel {
  private previews: Map<string, PreviewState> = new Map();

  /**
   * Register a preview for a project at the given URL.
   */
  createPreview(projectId: string, url: string): void {
    const state: PreviewState = {
      projectId,
      url,
      active: true,
    };
    this.previews.set(projectId, state);

    // ── Skeleton: iframe / webview creation ─────────────────────
    // const iframe = document.createElement('iframe');
    // iframe.src = url;
    // iframe.style.width = '100%';
    // iframe.style.height = '100%';
    // iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    // container.appendChild(iframe);
  }

  /**
   * Update the preview URL for an existing project.
   */
  updateUrl(projectId: string, url: string): void {
    const state = this.previews.get(projectId);
    if (!state) {
      throw new Error(`No preview found for project: ${projectId}`);
    }

    state.url = url;

    // ── Skeleton: update iframe src ─────────────────────────────
    // iframe.src = url;
  }

  /**
   * Tear down a preview.
   */
  destroyPreview(projectId: string): void {
    const state = this.previews.get(projectId);
    if (!state) {
      return;
    }

    state.active = false;
    this.previews.delete(projectId);

    // ── Skeleton: remove iframe / webview ───────────────────────
    // iframe.remove();
  }

  /**
   * Get the current preview state for a project.
   */
  getPreview(projectId: string): PreviewState | undefined {
    return this.previews.get(projectId);
  }

  /**
   * Return all active previews.
   */
  getAllPreviews(): PreviewState[] {
    return Array.from(this.previews.values()).filter((p) => p.active);
  }
}

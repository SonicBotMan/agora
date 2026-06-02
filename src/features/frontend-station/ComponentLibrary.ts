/**
 * ComponentLibrary — UI component library browser.
 *
 * Skeleton implementation for browsing and inspecting reusable UI
 * components. Designed to be backed by Storybook, a custom registry,
 * or a design-system package in the workspace.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ComponentInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  props?: ComponentProp[];
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

// ── Library Manager ─────────────────────────────────────────────────────────

export class ComponentLibrary {
  private categories: Map<string, ComponentInfo[]> = new Map();

  /**
   * List all component categories.
   */
  listCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * List all components in a category.
   */
  listComponents(category: string): ComponentInfo[] {
    return this.categories.get(category) ?? [];
  }

  /**
   * Get the source code for a component.
   */
  getComponentCode(componentId: string): string {
    // ── Skeleton: lookup component code ─────────────────────────
    // const component = this.findComponent(componentId);
    // if (!component) throw new Error(`Component not found: ${componentId}`);
    // return fs.readFileSync(component.filePath, 'utf-8');

    return `// Component: ${componentId}\n// Source not loaded`;
  }

  /**
   * Register a component in the library.
   */
  registerComponent(component: ComponentInfo): void {
    const list = this.categories.get(component.category) ?? [];
    list.push(component);
    this.categories.set(component.category, list);
  }

  /**
   * Bulk register components.
   */
  registerComponents(components: ComponentInfo[]): void {
    for (const comp of components) {
      this.registerComponent(comp);
    }
  }

  /**
   * Remove a component by ID.
   */
  unregisterComponent(componentId: string): void {
    for (const [category, list] of this.categories.entries()) {
      const idx = list.findIndex((c) => c.id === componentId);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) {
          this.categories.delete(category);
        }
        return;
      }
    }
  }

  /**
   * Search components by name or description.
   */
  searchComponents(query: string): ComponentInfo[] {
    const lower = query.toLowerCase();
    const results: ComponentInfo[] = [];
    for (const list of this.categories.values()) {
      for (const comp of list) {
        if (
          comp.name.toLowerCase().includes(lower) ||
          comp.description.toLowerCase().includes(lower)
        ) {
          results.push(comp);
        }
      }
    }
    return results;
  }
}

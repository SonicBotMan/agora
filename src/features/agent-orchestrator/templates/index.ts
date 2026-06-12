/**
 * Templates barrel export.
 */

export { deepInvestigationTemplate } from './deep-investigation';
export { planDesignTemplate } from './plan-design';
export { projectDevTemplate } from './project-dev';

import type { WorkflowTemplate } from '../types';
import { deepInvestigationTemplate } from './deep-investigation';
import { planDesignTemplate } from './plan-design';
import { projectDevTemplate } from './project-dev';

/** All built-in templates available by default. */
export const builtInTemplates: WorkflowTemplate[] = [
  projectDevTemplate,
  planDesignTemplate,
  deepInvestigationTemplate,
];

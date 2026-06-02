/**
 * Templates barrel export.
 */

export { projectDevTemplate } from './project-dev';
export { planDesignTemplate } from './plan-design';
export { deepInvestigationTemplate } from './deep-investigation';

import type { WorkflowTemplate } from '../types';
import { projectDevTemplate } from './project-dev';
import { planDesignTemplate } from './plan-design';
import { deepInvestigationTemplate } from './deep-investigation';

/** All built-in templates available by default. */
export const builtInTemplates: WorkflowTemplate[] = [
  projectDevTemplate,
  planDesignTemplate,
  deepInvestigationTemplate,
];

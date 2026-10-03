/** Calc workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const CALC_WORKBENCHES: ToolWorkbenchMap = {
  mathEvaluator: lazy(() => import('./MathEvaluatorWorkbench')),
  percentageCalculator: lazy(() => import('./PercentageWorkbench')),
  etaCalculator: lazy(() => import('./EtaWorkbench')),
  benchmarkTool: lazy(() => import('./BenchmarkWorkbench')),
  ageCalculator: lazy(() => import('./AgeWorkbench')),
  bmiCalculator: lazy(() => import('./BmiWorkbench')),
  loanEmiCalculator: lazy(() => import('./LoanEmiWorkbench')),
  gstCalculator: lazy(() => import('./GstWorkbench')),
  numberToWords: lazy(() => import('./NumberToWordsWorkbench')),
  ipCalculator: lazy(() => import('./IpSubnetWorkbench')),
  ipv4RangeExpander: lazy(() => import('./Ipv4RangeWorkbench')),
  ipv6UlaGenerator: lazy(() => import('./Ipv6UlaWorkbench')),
  macGenerator: lazy(() => import('./MacGeneratorWorkbench')),
  macLookup: lazy(() => import('./MacLookupWorkbench')),
  userAgentParser: lazy(() => import('./UserAgentWorkbench')),
  chmodCalculator: lazy(() => import('./ChmodWorkbench')),
  randomPortGenerator: lazy(() => import('./RandomPortWorkbench')),
  ipv4Converter: lazy(() => import('./Ipv4ConverterWorkbench')),
};

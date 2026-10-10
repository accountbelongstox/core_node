import { defineMobileLocale } from './defineMobileLocale';

/** Work package B: marketplace, projects, tasks, reviews, architect. */
export const cmMobileWpB = defineMobileLocale(
  {
    work: {
      openLink: 'Open',
      chooseFiles: 'Choose files',
      resubmit: 'Resubmit',
      resubmitTitle: 'Resubmit your deliverable',
      projectTabs: {
        overview: 'Overview',
        analysis: 'AI',
        milestones: 'Milestones',
        tasks: 'Tasks',
        files: 'Files',
      },
      create: {
        stepsLabel: 'Create project steps',
        steps: {
          brief: 'Project brief',
          budget: 'Budget and schedule',
          stack: 'Stack and files',
        },
        lead: {
          brief: 'Name the project and describe what you need built.',
          budget: 'Set your budget and, if you know them, the dates.',
          stack: 'Add the technologies you prefer and any reference files.',
        },
        filesHint: 'Allowed types: {{types}}. Up to {{size}} MB each.',
      },
      architect: {
        planHint: 'Open the project to plan milestones and tasks',
      },
    },
    marketplace: {
      filters: 'Filters',
      filtersTitle: 'Filter tasks',
      taskDetails: 'Task details',
      showResults: 'Show tasks',
    },
  },
  {
    work: {
      openLink: '打开',
      chooseFiles: '选择文件',
      resubmit: '重新提交',
      resubmitTitle: '重新提交交付物',
      projectTabs: {
        overview: '概览',
        analysis: 'AI 分析',
        milestones: '里程碑',
        tasks: '任务',
        files: '附件',
      },
      create: {
        stepsLabel: '创建项目步骤',
        steps: {
          brief: '项目简介',
          budget: '预算与周期',
          stack: '技术栈与附件',
        },
        lead: {
          brief: '给项目起个名字，并描述你需要做什么。',
          budget: '设置预算；如已确定，也可填写起止日期。',
          stack: '填写偏好的技术栈，并可附上参考文件。',
        },
        filesHint: '支持的类型：{{types}}，单个文件最大 {{size}} MB。',
      },
      architect: {
        planHint: '打开项目，规划里程碑和任务',
      },
    },
    marketplace: {
      filters: '筛选',
      filtersTitle: '筛选任务',
      taskDetails: '任务详情',
      showResults: '查看任务',
    },
  },
);

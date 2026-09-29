export const entryNames = [
  'InstructorHome',
  'PromptDesigner',
  'WizardPreview',
  'FeedbackAnalyzer',
  'FeedbackChat',
  'CourseBanner',
  'Customizations',
  'InstructorLogin',
  'InstructorPassword',
  'NotFound',
  'feedback',
] as const

export type EntryName = (typeof entryNames)[number]

export type EntryDefinition = {
  activeItem: string
  description: string
  pageTitle: string
}

const entries: Record<EntryName, EntryDefinition> = {
  InstructorHome: {
    activeItem: 'all-courses',
    description: 'Learning experience workspace',
    pageTitle: 'LEAI',
  },
  PromptDesigner: {
    activeItem: 'prompt-designer',
    description: 'Create and manage AI-powered feedback surveys for your course.',
    pageTitle: 'Prompt Designer',
  },
  WizardPreview: {
    activeItem: 'wizard-preview',
    description: 'Practice this feedback conversation.',
    pageTitle: 'Student preview',
  },
  FeedbackAnalyzer: {
    activeItem: 'feedback-analyzer',
    description: 'Review survey results and student engagement across your course.',
    pageTitle: 'Feedback Analyzer',
  },
  FeedbackChat: {
    activeItem: 'feedback-chat',
    description: 'Chat with your survey data.',
    pageTitle: 'Feedback Chat',
  },
  CourseBanner: {
    activeItem: 'settings',
    description: 'Adjust this course’s feedback settings.',
    pageTitle: 'Settings',
  },
  Customizations: {
    activeItem: 'settings',
    description: 'Adjust this course’s feedback settings.',
    pageTitle: 'Settings',
  },
  InstructorLogin: {
    activeItem: 'instructor-login',
    description: 'Instructor account sign in',
    pageTitle: 'Instructor sign in',
  },
  InstructorPassword: {
    activeItem: 'instructor-password',
    description: 'Change your instructor password',
    pageTitle: 'Change password',
  },
  NotFound: {
    activeItem: 'not-found',
    description: 'The requested page could not be found.',
    pageTitle: 'Page Not Found',
  },
  feedback: {
    activeItem: 'feedback',
    description: 'Student feedback experience',
    pageTitle: 'Feedback',
  },
}

export function getEntry(entryName: string): EntryDefinition {
  if (!Object.hasOwn(entries, entryName)) {
    throw new Error(`LEAI entry configuration error: unknown entry "${entryName}"`)
  }

  return entries[entryName as EntryName]
}

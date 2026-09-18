export const entryNames = [
  'InstructorHome',
  'PromptDesigner',
  'FeedbackAnalyzer',
  'FeedbackChat',
  'CourseBanner',
  'Customizations',
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
    activeItem: 'prompt-designer',
    description: 'Learning experience workspace',
    pageTitle: 'LEAI',
  },
  PromptDesigner: {
    activeItem: 'prompt-designer',
    description: 'Create and manage feedback experiences for this course.',
    pageTitle: 'Prompt Designer',
  },
  FeedbackAnalyzer: {
    activeItem: 'feedback-analyzer',
    description: 'Review feedback as it arrives.',
    pageTitle: 'Feedback Analyzer',
  },
  FeedbackChat: {
    activeItem: 'feedback-chat',
    description: 'Explore feedback themes with AI assistance.',
    pageTitle: 'Feedback Chat',
  },
  CourseBanner: {
    activeItem: 'course-banner',
    description: 'Set the course-level feedback introduction.',
    pageTitle: 'Course Banner',
  },
  Customizations: {
    activeItem: 'customizations',
    description: 'Adjust course feedback settings.',
    pageTitle: 'Customizations',
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

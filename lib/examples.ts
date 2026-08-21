/** Starter prompts, shared by the landing hero and the workspace composer.
 *  The label is a short product name so the chips stay on two rows; the prompt
 *  is the full sentence that lands in the textarea on click. Each carries an
 *  icon key and a tint so the cloud reads as a palette rather than a list. */
export type IconKey =
  | 'clock'
  | 'history'
  | 'pen'
  | 'moon'
  | 'bell'
  | 'code'
  | 'doc'
  | 'bookmark'
  | 'link'
  | 'chart';

export type Example = {
  label: string;
  prompt: string;
  targets: string[];
  icon: IconKey;
  tint: string;
};

export const EXAMPLES: Example[] = [
  {
    label: 'Pomodoro Timer',
    icon: 'clock',
    tint: '#F97316',
    prompt:
      'A popup with a 25 minute pomodoro timer that badges the toolbar icon with the minutes left and notifies me when the session ends.',
    targets: ['popup', 'background'],
  },
  {
    label: 'History Search',
    icon: 'history',
    tint: '#3B82F6',
    prompt:
      'A popup that searches my browsing history by keyword and shows the ten most recent matches with their titles and dates.',
    targets: ['popup'],
  },
  {
    label: 'Page Highlighter',
    icon: 'pen',
    tint: '#8B5CF6',
    prompt:
      'Let me select text on any page and highlight it in yellow, and keep the highlights when I come back to that page.',
    targets: ['content_script'],
  },
  {
    label: 'Dark Mode',
    icon: 'moon',
    tint: '#6366F1',
    prompt:
      'A toggle in the popup that forces a dark colour scheme on any website by inverting its background and text colours.',
    targets: ['popup', 'content_script'],
  },
  {
    label: 'Exercise Reminder',
    icon: 'bell',
    tint: '#0EA5E9',
    prompt:
      'Remind me to stand up and stretch every 45 minutes with a desktop notification I can snooze from the popup.',
    targets: ['popup', 'background'],
  },
  {
    label: 'CSS Inspector',
    icon: 'code',
    tint: '#EC4899',
    prompt:
      'Hover any element on a page and show its CSS selector, font size and colour in a small floating panel.',
    targets: ['content_script'],
  },
  {
    label: 'Page Notes',
    icon: 'doc',
    tint: '#16A34A',
    prompt:
      'Let me write a short note for the page I am on and show it again automatically the next time I visit that URL.',
    targets: ['popup', 'content_script'],
  },
  {
    label: 'Reading List',
    icon: 'bookmark',
    tint: '#0D9488',
    prompt:
      'Save the current page title and URL to a reading list I can view in the popup, newest first.',
    targets: ['popup'],
  },
  {
    label: 'Link Outliner',
    icon: 'link',
    tint: '#EA580C',
    prompt: 'Highlight every external link on a page with a coloured outline.',
    targets: ['content_script'],
  },
  {
    label: 'Tab Deduper',
    icon: 'chart',
    tint: '#DC2626',
    prompt: 'A popup that counts my open tabs and closes duplicates.',
    targets: ['popup'],
  },
];

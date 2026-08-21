/** Starter prompts, shared by the landing hero and the dashboard composer.
 *  The label is a short product name so the chips stay on one or two rows;
 *  the prompt is the full sentence that lands in the textarea on click. */
export type Example = { label: string; prompt: string; targets: string[] };

export const EXAMPLES: Example[] = [
  {
    label: 'Tab Deduper',
    prompt: 'A popup that counts my open tabs and closes duplicates.',
    targets: ['popup'],
  },
  {
    label: 'Link Outliner',
    prompt: 'Highlight every external link on a page with a coloured outline.',
    targets: ['content_script'],
  },
  {
    label: 'Reading List',
    prompt: 'Save the current page title and URL to a reading list I can view in the popup.',
    targets: ['popup'],
  },
  {
    label: 'Word Counter',
    prompt: 'Show a word and character count for the text I select on any page.',
    targets: ['content_script'],
  },
  {
    label: 'Pomodoro Timer',
    prompt:
      'A popup with a 25 minute pomodoro timer that badges the toolbar icon with the minutes left and notifies me when the session ends.',
    targets: ['popup', 'background'],
  },
  {
    label: 'Dark Mode',
    prompt:
      'A toggle in the popup that forces a dark colour scheme on any website by inverting its background and text colours.',
    targets: ['popup', 'content_script'],
  },
  {
    label: 'History Search',
    prompt:
      'A popup that searches my browsing history by keyword and shows the ten most recent matches with their titles and dates.',
    targets: ['popup'],
  },
  {
    label: 'CSS Inspector',
    prompt:
      'Hover any element on a page and show its CSS selector, font size and colour in a small floating panel.',
    targets: ['content_script'],
  },
];

import { describe, expect, it } from 'vitest';
import { adfToText } from './adf';

describe('adfToText', () => {
  it('flattens an ADF document into plain text with paragraph breaks', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Move sessions to ' }, { type: 'text', text: 'MongoDB.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'It scales better.' }] },
      ],
    };
    expect(adfToText(doc)).toBe('Move sessions to MongoDB.\nIt scales better.');
  });

  it('returns an empty string for null, strings and unknown shapes', () => {
    expect(adfToText(null)).toBe('');
    expect(adfToText(undefined)).toBe('');
    expect(adfToText(42)).toBe('');
  });

  it('passes plain strings through', () => {
    expect(adfToText('already text')).toBe('already text');
  });
});

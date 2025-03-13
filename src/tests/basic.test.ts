import { describe, expect, test } from 'bun:test';
import { searchFiles } from '../tools/search.js';
import { readFile } from '../tools/fileReader.js';
import { getProjectContext } from '../utils/codebase.js';

describe('Clara Tool Tests', () => {
  test('searchFiles should return a string', async () => {
    const result = await searchFiles('*.ts', '.');
    expect(typeof result).toBe('string');
  });

  test('readFile should return a string', async () => {
    const result = await readFile('package.json');
    expect(typeof result).toBe('string');
    expect(result).toContain('clara');
  });
  
  test('getProjectContext should return project information', async () => {
    const result = await getProjectContext();
    expect(typeof result).toBe('object');
    expect(result.content).toContain('Current directory');
  });
});
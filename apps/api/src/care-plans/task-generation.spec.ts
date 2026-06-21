import { describe, expect, it } from 'vitest';
import { generateTasks } from './task-generation';
describe('generateTasks', () => {
  it('generates a stable seven-day window without duplicates', () => {
    const definition = { id: 'def-1', petId: 'pet-1', startDate: new Date('2026-06-21T00:00:00Z'), endDate: new Date('2026-06-27T00:00:00Z'), scheduleTimes: ['08:00', '20:00'] };
    const result = generateTasks([definition], new Date('2026-06-21T12:00:00Z'));
    expect(result).toHaveLength(14);
    expect(new Set(result.map(item => `${item.taskDefinitionId}:${item.scheduledAt.toISOString()}`)).size).toBe(14);
  });
});


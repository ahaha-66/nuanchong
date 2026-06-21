export type ScheduledTask = { taskDefinitionId: string; petId: string; scheduledAt: Date };
export type GenerationDefinition = { id: string; petId: string; startDate: Date; endDate: Date; scheduleTimes: string[] };

export function generateTasks(definitions: GenerationDefinition[], from: Date, days = 7): ScheduledTask[] {
  const result: ScheduledTask[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (const definition of definitions) {
    for (let offset = 0; offset < days; offset++) {
      const day = new Date(start.getTime() + offset * 86400000);
      if (day < definition.startDate || day > new Date(definition.endDate.getTime() + 86399999)) continue;
      for (const time of definition.scheduleTimes) {
        const [hour, minute] = time.split(':').map(Number);
        result.push({ taskDefinitionId: definition.id, petId: definition.petId, scheduledAt: new Date(day.getTime() + hour * 3600000 + minute * 60000) });
      }
    }
  }
  return result;
}


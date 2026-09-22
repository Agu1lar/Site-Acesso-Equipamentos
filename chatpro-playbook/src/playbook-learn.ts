/**
 * Ranks lead summaries so the playbook learns from how the team actually resolved chats.
 */
export function summaryLearningHeat(summary: string) {
  let heat = 0;
  if (/resultado:\s*(proposta|fechamento|resolvido|andamento|transferido)/iu.test(summary)) {
    heat += 4;
  }
  if (/li[cç][aã]o:/iu.test(summary)) {
    heat += 3;
  }
  if (/o que a equipe fez:/iu.test(summary)) {
    heat += 2;
  }
  if (/preço:\s*(?!não citado)/iu.test(summary)) {
    heat += 1;
  }
  if (/dias:\s*(?!não citado)/iu.test(summary)) {
    heat += 1;
  }
  if (/frete:\s*(?!não citado)/iu.test(summary)) {
    heat += 1;
  }
  if (/resultado:\s*(parado|perdida|em-risco)/iu.test(summary)) {
    heat += 1;
  }
  return heat;
}

/**
 * Picks the summaries that teach how Acesso operates, not only threads with a quoted price.
 */
export function pickSummariesForPlaybook<T extends { summary: string }>(summaries: T[], limit: number) {
  const ranked = summaries.map((item, index) => ({
    item,
    index,
    heat: summaryLearningHeat(item.summary),
  }));
  ranked.sort((left, right) => right.heat - left.heat || left.index - right.index);
  return ranked.slice(0, limit).map((row) => row.item);
}

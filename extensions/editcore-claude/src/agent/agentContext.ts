import { loadProjectMemory, formatMemoryForPrompt } from '../memory/projectMemory';
import { hybridCodeSearch } from '../rag/chunkIndex';

export async function buildAgentContext(userTask: string): Promise<string> {
  const sections: string[] = [];

  const memory = await loadProjectMemory();
  const memoryBlock = formatMemoryForPrompt(memory);
  if (memoryBlock) {
    sections.push(memoryBlock);
  }

  try {
    const { keyword, rag } = await hybridCodeSearch(userTask, 8);
    if (keyword) sections.push(keyword);
    if (rag) sections.push(rag);
  } catch {
    // index opcional
  }

  sections.push(userTask);
  return sections.join('\n\n');
}

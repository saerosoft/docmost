import { common, createLowlight } from 'lowlight';

export const codeLowlight = createLowlight(common);
export const codeLanguages = codeLowlight.listLanguages();

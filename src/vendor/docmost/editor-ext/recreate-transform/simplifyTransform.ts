import { Transform, ReplaceStep } from "@tiptap/pm/transform";
import { getReplaceStep } from "./getReplaceStep";

export function simplifyTransform(tr: Transform) {
  if (!tr.steps.length) return undefined;
  const newTr = new Transform(tr.docs[0]);
  const oldSteps = tr.steps.slice();
  while (oldSteps.length) {
    let step = oldSteps.shift()!;
    while (oldSteps.length && step.merge(oldSteps[0])) {
      const addedStep = oldSteps.shift()!;
      if (step instanceof ReplaceStep && addedStep instanceof ReplaceStep) {
        const intermediate = step.apply(newTr.doc).doc;
        if (!intermediate) throw new Error("Could not apply a history comparison step.");
        const result = addedStep.apply(intermediate).doc;
        if (!result) throw new Error("Could not combine history comparison steps.");
        const replacement = getReplaceStep(newTr.doc, result);
        if (!replacement) throw new Error("Combined history step has no replacement.");
        step = replacement;
      } else {
        const merged = step.merge(addedStep);
        if (!merged) throw new Error("History comparison steps cannot be merged.");
        step = merged;
      }
    }
    newTr.step(step);
  }
  return newTr;
}

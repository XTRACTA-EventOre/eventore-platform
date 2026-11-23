import { OperationError } from '../application/OperationError.js';
import { decimal, mass, percentage, SCALE } from './decimalMass.js';
export function validatePurity(value) {
  const scaled = decimal(value, { zero: true });
  if (scaled > 100n*SCALE) throw new OperationError(400, 'INVALID_PURITY', 'La pureza debe estar entre 0 y 100');
  return value;
}
export function validateTransformation(inputs, plan) {
  if (!plan || !['Split','Merge'].includes(plan.mode) || !Array.isArray(plan.outputs) || plan.outputs.length < 1 || plan.outputs.length > 20) throw new OperationError(400, 'INVALID_TRANSFORMATION', 'Indica una división o fusión y sus salidas');
  if (plan.mode === 'Split' && (inputs.length !== 1 || plan.outputs.length < 2)) throw new OperationError(400, 'INVALID_SPLIT', 'La división requiere una entrada y al menos dos salidas identificadas');
  if (plan.mode === 'Merge' && (inputs.length < 2 || plan.outputs.length !== 1)) throw new OperationError(400, 'INVALID_MERGE', 'La fusión requiere al menos dos entradas y una salida');
  const before = inputs.reduce((sum, input) => sum+mass(input.weight,input.weightUnit),0n);
  const outputs = plan.outputs.reduce((sum, output) => {
    if (typeof output.destination !== 'string' || !output.destination.trim() || !['Output','Remainder'].includes(output.kind)) throw new OperationError(400, 'INVALID_OUTPUT', 'Cada salida necesita destino y clasificación como producto o remanente');
    return sum+mass(output.weight,output.weightUnit);
  },0n);
  const loss = plan.technicalLoss ? mass(plan.technicalLoss.weight,plan.technicalLoss.weightUnit,{zero:true}) : 0n;
  const impurities = plan.impurities ? mass(plan.impurities.weight,plan.impurities.weightUnit,{zero:true}) : 0n;
  if ((loss>0n||impurities>0n)&&!plan.reason?.trim()) throw new OperationError(400, 'BALANCE_REASON_REQUIRED', 'Justifica merma e impurezas por separado');
  if (outputs+loss+impurities!==before) throw new OperationError(409, 'MASS_IMBALANCE', 'Las salidas, remanentes, merma e impurezas deben explicar toda la masa de entrada');
  return { inputMassScaledGrams: before.toString(), technicalLossPercentage: percentage(loss,before), criticalLoss: loss*100n>before*5n };
}

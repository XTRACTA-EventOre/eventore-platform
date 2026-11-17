import { describe,test,expect } from '@jest/globals';
import { validatePurity,validateTransformation } from '../../src/shared/domain/processingRules.js';
const input=[{weight:'100',weightUnit:'kg'}];
const output=(weight,kind='Output')=>({weight,weightUnit:'kg',destination:'Línea de prueba',kind});
describe('processing mass and assay invariants',()=>{
  test('purity accepts zero and one hundred but rejects invalid ranges',()=>{
    expect(validatePurity('0')).toBe('0');expect(validatePurity('100')).toBe('100');
    for(const value of ['100.1','-1','abc',50])expect(()=>validatePurity(value)).toThrow();
  });
  test('split accounts for all outputs, explicit remainder, loss and impurities',()=>{
    expect(validateTransformation(input,{mode:'Split',outputs:[output('40'),output('30'),output('20','Remainder')],technicalLoss:{weight:'5',weightUnit:'kg'},impurities:{weight:'5',weightUnit:'kg'},reason:'Balance documentado'})).toMatchObject({technicalLossPercentage:'5',criticalLoss:false});
    expect(()=>validateTransformation(input,{mode:'Split',outputs:[output('60'),output('50')]})).toThrow('toda la masa');
    expect(()=>validateTransformation(input,{mode:'Split',outputs:[output('60'),output('30')]})).toThrow('toda la masa');
  });
  test('loss strictly above five percent is flagged separately from impurities',()=>{
    expect(validateTransformation(input,{mode:'Split',outputs:[output('40'),output('54')],technicalLoss:{weight:'6',weightUnit:'kg'},reason:'Merma documentada'}).criticalLoss).toBe(true);
    expect(validateTransformation(input,{mode:'Split',outputs:[output('40'),output('50')],impurities:{weight:'10',weightUnit:'kg'},reason:'Impurezas separadas'}).criticalLoss).toBe(false);
  });
});

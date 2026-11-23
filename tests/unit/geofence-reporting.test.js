import{test,expect}from'@jest/globals';
import{polygon,contains}from'../../src/shared/domain/geofence.js';
import{mass,formatMass}from'../../src/shared/domain/decimalMass.js';
import{csvCell,lossReport}from'../../src/shared/domain/reporting.js';
const square=[{latitude:0,longitude:0},{latitude:0,longitude:2},{latitude:2,longitude:2},{latitude:2,longitude:0}];
test('polygon includes boundary and rejects a crossing or degenerate geometry',()=>{expect(contains(square,{latitude:1,longitude:1})).toBe(true);expect(contains(square,{latitude:0,longitude:1})).toBe(true);expect(contains(square,{latitude:3,longitude:1})).toBe(false);expect(()=>polygon([square[0],square[2],square[1],square[3]])).toThrow();});
test('CSV quotes separators/newlines and neutralizes spreadsheet formula prefixes',()=>{expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');expect(csvCell('  =1+2')).toBe('"\'  =1+2"');});
test('weighted mass uses exact compatible units rather than an average of percentages',()=>{const event=(grossWeight,loss,unit)=>({action:'TechnicalLossRecorded',grossWeight,grossUnit:unit,removedWeight:loss,weightUnit:unit,removedKind:'TechnicalLoss'});const r=lossReport([event('100','10','g'),event('0.9','0.009','kg')]);expect(r.weightedLossPercentage).toBe('1.9');});

test('normalized stock and aggregate grams can represent the full SQL weight range without rounding',()=>{const input='99999999999999999999999999999999999';const grams=formatMass(mass(input,'t'),'g',{maxIntegerDigits:45});expect(grams).toBe(input+'000000');expect(mass(grams,'g',{maxIntegerDigits:45})).toBe(mass(input,'t'));});

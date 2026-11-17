import{test,expect}from'@jest/globals';
import{readFileSync}from'node:fs';
import{ROLE_PERMISSIONS}from'../src/shared/infrastructure/http/permissions.js';
import SwaggerParser from'@apidevtools/swagger-parser';
for(const name of ['openapi','identity-openapi','traceability-openapi','logistics-openapi','processing-openapi','jewelry-openapi','certification-openapi','devices-openapi','reporting-openapi'])test(`${name} is a valid self-contained OpenAPI contract`,async()=>{
 const source=JSON.parse(readFileSync(new URL('../docs/'+name+'.json',import.meta.url),'utf8'));
 if(['openapi','identity-openapi'].includes(name))expect(source.paths['/auth/roles'].get.responses['200'].content['application/json'].example.roles).toEqual(ROLE_PERMISSIONS);
 const api=await SwaggerParser.validate(source);expect(api.openapi).toBe('3.0.3');expect(Object.keys(api.paths).length).toBeGreaterThan(0);
});
test('scope reconciles every original story once and computes implemented and remaining points',()=>{
 const scope=JSON.parse(readFileSync(new URL('../docs/avance4/scope.json',import.meta.url),'utf8'));
 const all=[...scope.stories,...scope.sprint4],selected=scope.stories.reduce((sum,story)=>sum+story.points,0),remaining=scope.sprint4.reduce((sum,story)=>sum+story.points,0);
 expect(new Set(all.map(story=>story.id)).size).toBe(53);expect(all).toHaveLength(53);
 expect(selected).toBe(scope.implementedStoryPoints);expect(selected+remaining).toBe(scope.totalStoryPoints);
 expect(scope.implementedPercent).toBe(Math.round(selected/scope.totalStoryPoints*10000)/100);
 expect(scope.stories.some(story=>story.id==='US53')).toBe(true);expect(scope.sprint4.some(story=>story.id==='US53')).toBe(false);
 const matrix=readFileSync(new URL('../docs/avance4/acceptance-matrix.md',import.meta.url),'utf8');
 expect((matrix.match(/^\| US\d+-AC\d+ /gm)??[]).length).toBe(scope.criteriaCount);
});

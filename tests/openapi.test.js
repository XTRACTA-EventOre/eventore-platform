import{test,expect}from'@jest/globals';
import{readFileSync}from'node:fs';
import SwaggerParser from'@apidevtools/swagger-parser';
for(const name of ['openapi','identity-openapi','traceability-openapi','logistics-openapi','processing-openapi','jewelry-openapi','certification-openapi','devices-openapi','reporting-openapi'])test(`${name} is a valid self-contained OpenAPI contract`,async()=>{
 const source=JSON.parse(readFileSync(new URL('../docs/'+name+'.json',import.meta.url),'utf8'));
 const api=await SwaggerParser.validate(source);expect(api.openapi).toBe('3.0.3');expect(Object.keys(api.paths).length).toBeGreaterThan(0);
});

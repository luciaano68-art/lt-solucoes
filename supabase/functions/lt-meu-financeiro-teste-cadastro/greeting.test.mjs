import {test} from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
const {greetingDay,greetingMessage}=await import(existsSync(new URL('../api/greeting.js',import.meta.url))?'../api/greeting.js':'../lt-meu-financeiro-teste-api/greeting.js');
test('welcome and daily greeting share one id per user and Brazilian date',async()=>{
 const morning=new Date('2026-10-11T10:00:00Z'),afternoon=new Date('2026-10-11T18:00:00Z'),night=new Date('2026-10-11T23:00:00Z');
 const first=await greetingMessage({id:'a'},true,morning),daily=await greetingMessage({id:'a'},false,morning);
 assert.match(first.text,/Bem-vindo/);assert.match(daily.text,/^Bom dia!/);assert.equal(first.id,daily.id);
 assert.equal((await greetingMessage({id:'a'},false,afternoon)).id,daily.id);assert.match((await greetingMessage({id:'a'},false,afternoon)).text,/^Boa tarde!/);
 assert.match((await greetingMessage({id:'a'},false,night)).text,/^Boa noite!/);
 assert.notEqual((await greetingMessage({id:'b'},false,morning)).id,daily.id);
 assert.notEqual((await greetingMessage({id:'a'},false,new Date('2026-10-12T10:00:00Z'))).id,daily.id);
 assert.equal(greetingDay(new Date('2026-10-12T01:00:00Z')),'2026-10-11');
});

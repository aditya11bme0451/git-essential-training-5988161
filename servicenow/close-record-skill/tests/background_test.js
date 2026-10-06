/**
 * Run in System Definition → Scripts - Background.
 * Checks the deterministic part (no AI): number detection and record facts.
 * Replace the numbers with real ones from your instance.
 */
var v = new global.CloseRecordValidator();
var me = gs.getUserID();

gs.info('1) Extract: ' + JSON.stringify(v.extractNumbers('close ritm 10023 and SCTASK-45 please, also sctask0010045')));
// expect ["RITM0010023","SCTASK0000045","SCTASK0010045"]

gs.info('2) Validate RITM: ' + JSON.stringify(v.validate('RITM0010023', me)));
gs.info('3) Validate SCTASK: ' + JSON.stringify(v.validate('please close sctask 10045', me)));
gs.info('4) Not found: ' + JSON.stringify(v.validate('RITM9999999', me)));
gs.info('5) No number: ' + JSON.stringify(v.validate('close the laptop task', me)));

// Parsing the skill's Flow action output (with code fences around the JSON):
var sample = JSON.stringify({ model_output: '```json\n{"decision":"close","number":"SCTASK0010045","record_type":"Catalog Task (SCTASK)","message":"ok"}\n```' });
gs.info('6) Parse: ' + JSON.stringify(v.parseSkillResponse(sample)));

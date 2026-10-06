/**
 * Script Include: CloseRecordValidator
 * Application:    Global
 * Accessible from: All application scopes
 * Client callable: false
 *
 * Deterministic checks for the "Close RITM or SCTASK" catalog item. Used by:
 *   - the Now Assist Skill Kit skill "Validate Close Request" (script tool),
 *     which feeds the facts to the LLM;
 *   - the flow action "Close RITM or SCTASK", which re-checks and closes.
 * The LLM never decides whether a record exists or may be closed; this does.
 */
var CloseRecordValidator = Class.create();
CloseRecordValidator.prototype = {

    // Number prefixes and padding. Adjust if Number Maintenance differs.
    TYPES: [
        { prefix: 'RITM', table: 'sc_req_item', label: 'Requested Item (RITM)' },
        { prefix: 'SCTASK', table: 'sc_task', label: 'Catalog Task (SCTASK)' }
    ],
    NUMBER_DIGITS: 7,
    STATE_CLOSED_COMPLETE: 3,

    initialize: function() {},

    /**
     * Finds every RITM/SCTASK number in free text and normalises it:
     * "ritm 10023", "SCTASK-45", "sctask0010045" → RITM0010023, SCTASK0000045, SCTASK0010045.
     * Returns a de-duplicated array of numbers.
     */
    extractNumbers: function(text) {
        var prefixes = [];
        for (var i = 0; i < this.TYPES.length; i++)
            prefixes.push(this.TYPES[i].prefix);
        var re = new RegExp('\\b(' + prefixes.join('|') + ')[\\s#:-]*(\\d{1,' + (this.NUMBER_DIGITS + 3) + '})\\b', 'gi');

        var found = [];
        var m;
        var s = (text || '').toString();
        while ((m = re.exec(s)) !== null) {
            var digits = m[2];
            while (digits.length < this.NUMBER_DIGITS)
                digits = '0' + digits;
            var num = m[1].toUpperCase() + digits;
            if (found.indexOf(num) < 0)
                found.push(num);
        }
        return found;
    },

    /**
     * Facts about every number mentioned in the text, for the skill's prompt.
     * Returns { numbers_found: n, records: [ {...} ] } (always JSON-serialisable).
     */
    validate: function(text, userSysId) {
        var numbers = this.extractNumbers(text);
        var records = [];
        for (var i = 0; i < numbers.length; i++)
            records.push(this.describe(numbers[i], userSysId));
        return { numbers_found: numbers.length, records: records };
    },

    /** Facts about one number: type, state, owner, and whether this user may close it. */
    describe: function(number, userSysId) {
        var rec = this._find(number);
        if (!rec)
            return { number: number, found: false };

        var gr = rec.gr;
        var isRitm = rec.type.table == 'sc_req_item';
        var ritm = isRitm ? gr : gr.request_item.getRefRecord();
        return {
            number: number,
            found: true,
            record_type: rec.type.label,
            table: rec.type.table,
            sys_id: gr.getUniqueValue(),
            description: isRitm ? gr.getDisplayValue('cat_item') : gr.getValue('short_description'),
            state: gr.getDisplayValue('state'),
            active: gr.getValue('active') == '1',
            requested_for: ritm.isValidRecord() ? ritm.getDisplayValue('requested_for') : '',
            parent_ritm: isRitm ? '' : (ritm.isValidRecord() ? ritm.getValue('number') : ''),
            open_tasks: isRitm ? this._openTaskCount(gr.getUniqueValue()) : 0,
            user_can_close: this.canClose(gr, ritm, userSysId)
        };
    },

    /** Requester, requested-for, or a member of the record's assignment group. */
    canClose: function(gr, ritm, userSysId) {
        var user = (userSysId || '') + '';
        if (!user)
            return false;
        if (ritm && ritm.isValidRecord() &&
            (ritm.getValue('requested_for') == user || ritm.getValue('opened_by') == user))
            return true;
        var group = gr.getValue('assignment_group');
        if (!group)
            return false;
        var mem = new GlideRecord('sys_user_grmember');
        mem.addQuery('user', user);
        mem.addQuery('group', group);
        mem.setLimit(1);
        mem.query();
        return mem.hasNext();
    },

    /**
     * Closes the record after re-checking everything. For a RITM, its open
     * SCTASKs are closed first so the RITM is not reopened.
     * Returns { status: 'ok'|'error', message, record_type, number }.
     */
    close: function(number, closeNotes, userSysId) {
        var nums = this.extractNumbers(number);
        if (nums.length != 1)
            return { status: 'error', message: 'Expected exactly one RITM or SCTASK number, got "' + number + '".' };

        var facts = this.describe(nums[0], userSysId);
        if (!facts.found)
            return { status: 'error', number: nums[0], message: 'No RITM or SCTASK found with number ' + nums[0] + '.' };
        if (!facts.active)
            return { status: 'error', number: nums[0], record_type: facts.record_type, message: nums[0] + ' is already closed.' };
        if (!facts.user_can_close)
            return { status: 'error', number: nums[0], record_type: facts.record_type, message: 'You are not allowed to close ' + nums[0] + '.' };

        var notes = (closeNotes || '').toString();
        var gr = this._find(nums[0]).gr;
        if (facts.table == 'sc_req_item') {
            var t = new GlideRecord('sc_task');
            t.addQuery('request_item', gr.getUniqueValue());
            t.addActiveQuery();
            t.query();
            while (t.next()) {
                t.setValue('state', this.STATE_CLOSED_COMPLETE);
                t.work_notes = 'Closed with parent ' + nums[0] + ' via Otto: ' + notes;
                t.update();
            }
        }
        gr.setValue('state', this.STATE_CLOSED_COMPLETE);
        gr.work_notes = 'Closed via Otto request: ' + notes;
        gr.update();

        return {
            status: 'ok',
            number: nums[0],
            record_type: facts.record_type,
            message: facts.record_type + ' ' + nums[0] + ' has been closed.'
        };
    },

    /**
     * Reads the skill's answer from the Flow action's "response" output.
     * Tolerates code fences / text around the JSON. Returns an object with
     * decision, number, record_type, message (decision 'error' on failure).
     */
    parseSkillResponse: function(response) {
        try {
            var body = typeof response == 'string' ? JSON.parse(response) : response;
            var text = (body && (body.model_output || body.output)) || response;
            text = (text || '').toString();
            var start = text.indexOf('{');
            var end = text.lastIndexOf('}');
            var obj = JSON.parse(text.substring(start, end + 1));
            return {
                decision: (obj.decision || '').toString().toLowerCase(),
                number: (obj.number || '').toString(),
                record_type: (obj.record_type || '').toString(),
                message: (obj.message || '').toString()
            };
        } catch (e) {
            return { decision: 'error', number: '', record_type: '', message: 'Could not read the validation result: ' + e };
        }
    },

    _find: function(number) {
        for (var i = 0; i < this.TYPES.length; i++) {
            if (number.indexOf(this.TYPES[i].prefix) !== 0)
                continue;
            var gr = new GlideRecord(this.TYPES[i].table);
            if (gr.get('number', number))
                return { gr: gr, type: this.TYPES[i] };
        }
        return null;
    },

    _openTaskCount: function(ritmSysId) {
        var ga = new GlideAggregate('sc_task');
        ga.addQuery('request_item', ritmSysId);
        ga.addActiveQuery();
        ga.addAggregate('COUNT');
        ga.query();
        return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;
    },

    type: 'CloseRecordValidator'
};

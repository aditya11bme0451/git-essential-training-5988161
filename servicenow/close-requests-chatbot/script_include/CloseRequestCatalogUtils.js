/**
 * Script Include: CloseRequestCatalogUtils
 * Application:    Global
 * Accessible from: All application scopes
 * Client callable: false
 *
 * Catalog side of the "Close tasks/requests" chatbot: reads the Close code
 * choices from the catalog item and submits it with the two list collectors.
 * Requires the CloseRecordValidator script include (number detection/lookup).
 *
 * System properties (type string):
 *   x_close_chat.catalog_item_sys_id   sys_id of the "Close tasks/requests" item (required)
 *   x_close_chat.var.ritms             list collector variable → sc_req_item  (default: requested_items)
 *   x_close_chat.var.tasks             list collector variable → sc_task      (default: catalog_tasks)
 *   x_close_chat.var.close_code        Close code variable                    (default: close_code)
 *   x_close_chat.var.justification     Business justification variable        (default: business_justification)
 *   x_close_chat.enforce_permission    "true" (default): only records the user requested, is the
 *                                      requested-for of, or whose assignment group they are in
 */
var CloseRequestCatalogUtils = Class.create();
CloseRequestCatalogUtils.prototype = {

    PREFIX: 'x_close_chat.',

    initialize: function() {
        this.catItemSysId = gs.getProperty(this.PREFIX + 'catalog_item_sys_id', '');
        this.varRitms = gs.getProperty(this.PREFIX + 'var.ritms', 'requested_items');
        this.varTasks = gs.getProperty(this.PREFIX + 'var.tasks', 'catalog_tasks');
        this.varCloseCode = gs.getProperty(this.PREFIX + 'var.close_code', 'close_code');
        this.varJustification = gs.getProperty(this.PREFIX + 'var.justification', 'business_justification');
        this.enforcePermission = gs.getProperty(this.PREFIX + 'enforce_permission', 'true') == 'true';
        this.validator = new CloseRecordValidator();
    },

    /** Returns null when configured correctly, otherwise { status: 'error', message }. */
    checkConfig: function() {
        if (!this.catItemSysId)
            return { status: 'error', message: 'System property ' + this.PREFIX + 'catalog_item_sys_id is not set.' };
        var item = new GlideRecord('sc_cat_item');
        if (!item.get(this.catItemSysId) || item.getValue('active') != '1')
            return { status: 'error', message: 'Catalog item ' + this.catItemSysId + ' was not found or is inactive.' };
        var names = [this.varRitms, this.varTasks, this.varCloseCode, this.varJustification];
        for (var i = 0; i < names.length; i++) {
            if (!this._variableSysId(names[i]))
                return { status: 'error', message: 'Variable "' + names[i] + '" was not found on the catalog item.' };
        }
        return null;
    },

    /**
     * Close code choices from the catalog item ([{value, label}]).
     * An empty list means the variable is free text.
     */
    getCloseCodeOptions: function() {
        var options = [];
        var qc = new GlideRecord('question_choice');
        qc.addQuery('question', this._variableSysId(this.varCloseCode));
        qc.addQuery('inactive', false);
        qc.orderBy('order');
        qc.query();
        while (qc.next())
            options.push({ value: qc.getValue('value'), label: qc.getValue('text') });
        return options;
    },

    /** Matches a value or label (case-insensitive). Free text when there are no choices. */
    resolveCloseCode: function(input, options) {
        var wanted = (input || '').toString().trim();
        if (!wanted)
            return '';
        if (!options || !options.length)
            return wanted;
        var w = wanted.toLowerCase();
        for (var i = 0; i < options.length; i++) {
            if (options[i].value.toLowerCase() == w || options[i].label.toLowerCase() == w)
                return options[i].value;
        }
        return '';
    },

    /**
     * Looks up a number and says whether it can go on the request.
     * Returns the CloseRecordValidator facts plus "status":
     *   ok | not_found | already_closed | not_allowed
     */
    checkRecord: function(number, userSysId) {
        var facts = this.validator.describe(number, userSysId);
        if (!facts.found)
            facts.status = 'not_found';
        else if (!facts.active)
            facts.status = 'already_closed';
        else if (this.enforcePermission && !facts.user_can_close)
            facts.status = 'not_allowed';
        else
            facts.status = 'ok';
        return facts;
    },

    /**
     * Submits "Close tasks/requests". Every record is checked again first.
     * @param records [{number}] chosen in the chat
     * Returns { status, request_number, ritm_number, link, message }
     */
    submit: function(records, closeCode, justification, userSysId) {
        var cfg = this.checkConfig();
        if (cfg)
            return cfg;

        var ritmIds = [];
        var taskIds = [];
        for (var i = 0; i < records.length; i++) {
            var facts = this.checkRecord(records[i].number, userSysId);
            if (facts.status != 'ok')
                return { status: 'error', message: records[i].number + ' can no longer be closed (' + facts.status.replace('_', ' ') + ').' };
            if (facts.table == 'sc_req_item')
                ritmIds.push(facts.sys_id);
            else
                taskIds.push(facts.sys_id);
        }
        if (!ritmIds.length && !taskIds.length)
            return { status: 'error', message: 'Add at least one RITM or SCTASK number.' };

        var code = this.resolveCloseCode(closeCode, this.getCloseCodeOptions());
        if (!code)
            return { status: 'error', message: 'Close code "' + closeCode + '" is not a valid option.' };
        var why = (justification || '').toString().trim();
        if (!why)
            return { status: 'error', message: 'A business justification is required.' };

        try {
            var variables = {};
            variables[this.varRitms] = ritmIds.join(',');
            variables[this.varTasks] = taskIds.join(',');
            variables[this.varCloseCode] = code;
            variables[this.varJustification] = why;

            var result = new sn_sc.CartJS().orderNow({
                sysparm_id: this.catItemSysId,
                sysparm_quantity: '1',
                sysparm_requested_for: userSysId,
                variables: variables
            });

            var requestSysId = result.request_id || result.sys_id;
            var ritmNumber = '';
            var ritm = new GlideRecord('sc_req_item');
            ritm.addQuery('request', requestSysId);
            ritm.setLimit(1);
            ritm.query();
            if (ritm.next())
                ritmNumber = ritm.getValue('number');

            return {
                status: 'ok',
                request_number: result.request_number,
                ritm_number: ritmNumber,
                link: gs.getProperty('glide.servlet.uri') + 'sp?id=ticket&table=sc_request&sys_id=' + requestSysId,
                message: 'Request ' + result.request_number + ' submitted.'
            };
        } catch (e) {
            gs.error('CloseRequestCatalogUtils.submit failed: ' + e);
            return { status: 'error', message: 'The request could not be submitted: ' + e };
        }
    },

    // Finds the variable on the item itself or in a variable set attached to it.
    _variableSysId: function(name) {
        var sets = [];
        var link = new GlideRecord('io_set_item');
        link.addQuery('sc_cat_item', this.catItemSysId);
        link.query();
        while (link.next())
            sets.push(link.getValue('variable_set'));

        var v = new GlideRecord('item_option_new');
        var qc = v.addQuery('cat_item', this.catItemSysId);
        if (sets.length)
            qc.addOrCondition('variable_set', 'IN', sets.join(','));
        v.addQuery('name', name);
        v.setLimit(1);
        v.query();
        return v.next() ? v.getUniqueValue() : '';
    },

    type: 'CloseRequestCatalogUtils'
};

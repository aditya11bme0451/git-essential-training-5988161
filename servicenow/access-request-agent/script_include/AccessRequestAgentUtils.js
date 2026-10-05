/**
 * Script Include: AccessRequestAgentUtils
 * Application:    Global (or your scoped app)
 * Accessible from: All application scopes
 * Client callable: false
 *
 * Server-side helpers used by the "Access Request Assistant" AI agent tools
 * (AI Agent Studio) and by the optional Now Assist Skill Kit skill.
 *
 * Configuration lives in system properties so nothing is hard-coded:
 *   x_access_agent.catalog_item_sys_id   sys_id of your existing catalog item (required)
 *   x_access_agent.var.requested_for     variable name for "Requested for"   (default: requested_for)
 *   x_access_agent.var.action            variable name for "Action"          (default: action)
 *   x_access_agent.var.comments          variable name for "Comments"        (default: comments)
 */
var AccessRequestAgentUtils = Class.create();
AccessRequestAgentUtils.prototype = {

    PROP_PREFIX: 'x_access_agent.',
    MAX_USER_MATCHES: 5,

    initialize: function() {
        this.catItemSysId = gs.getProperty(this.PROP_PREFIX + 'catalog_item_sys_id', '');
        this.varRequestedFor = gs.getProperty(this.PROP_PREFIX + 'var.requested_for', 'requested_for');
        this.varAction = gs.getProperty(this.PROP_PREFIX + 'var.action', 'action');
        this.varComments = gs.getProperty(this.PROP_PREFIX + 'var.comments', 'comments');
    },

    /**
     * Find active users matching a name, user ID or email.
     * Returns { status, matches: [{sys_id, name, user_name, email, department}] }
     * The agent uses this to turn "John Smith" into a sys_user sys_id and to
     * ask the user to disambiguate when there is more than one match.
     */
    findUsers: function(searchTerm) {
        var term = (searchTerm || '').toString().trim();
        if (!term)
            return { status: 'error', message: 'Please provide a name, user ID or email to search for.', matches: [] };

        // "me" / "myself" resolves to the person chatting with the agent.
        if (/^(me|myself|self)$/i.test(term))
            term = gs.getUserID();

        var gr = new GlideRecord('sys_user');
        gr.addActiveQuery();
        var qc = gr.addQuery('sys_id', term);
        qc.addOrCondition('user_name', term);
        qc.addOrCondition('email', term);
        qc.addOrCondition('name', 'STARTSWITH', term);
        qc.addOrCondition('first_name', 'STARTSWITH', term);
        qc.addOrCondition('last_name', 'STARTSWITH', term);
        gr.orderBy('name');
        gr.setLimit(this.MAX_USER_MATCHES + 1);
        gr.query();

        var matches = [];
        while (gr.next()) {
            matches.push({
                sys_id: gr.getUniqueValue(),
                name: gr.getValue('name'),
                user_name: gr.getValue('user_name'),
                email: gr.getValue('email'),
                department: gr.getDisplayValue('department')
            });
        }

        var tooMany = matches.length > this.MAX_USER_MATCHES;
        if (tooMany)
            matches.pop();

        return {
            status: matches.length ? 'ok' : 'not_found',
            too_many_results: tooMany,
            message: matches.length ?
                (matches.length == 1 ? 'Exactly one user found.' :
                    'Multiple users found. Ask the user to pick one.' + (tooMany ? ' Results were truncated; ask for a more specific name.' : '')) :
                'No active user matched "' + searchTerm + '". Ask the user to check the spelling or provide an email.',
            matches: matches
        };
    },

    /**
     * Read the choices of the "Action" variable straight from the catalog item,
     * so the agent always offers exactly what the form offers (e.g. Add / Remove).
     * Returns { status, options: [{value, label}] }
     */
    getActionOptions: function() {
        var cfgError = this._checkConfig();
        if (cfgError)
            return cfgError;

        var varSysId = this._getVariableSysId(this.varAction);
        if (!varSysId)
            return { status: 'error', message: 'Variable "' + this.varAction + '" was not found on the catalog item.', options: [] };

        var options = [];
        var qc = new GlideRecord('question_choice');
        qc.addQuery('question', varSysId);
        qc.addQuery('inactive', false);
        qc.orderBy('order');
        qc.query();
        while (qc.next())
            options.push({ value: qc.getValue('value'), label: qc.getValue('text') });

        return { status: 'ok', options: options };
    },

    /**
     * Submit the catalog item on behalf of the user.
     * @param {string} requestedForSysId sys_user sys_id (from findUsers)
     * @param {string} action            choice value or label (e.g. "add" / "Add")
     * @param {string} comments          free text
     * Returns { status, request_number, request_sys_id, ritm_number, link, message }
     */
    submitRequest: function(requestedForSysId, action, comments) {
        var cfgError = this._checkConfig();
        if (cfgError)
            return cfgError;

        // --- validate Requested for ---------------------------------------
        var user = new GlideRecord('sys_user');
        if (!requestedForSysId || !user.get(requestedForSysId) || user.getValue('active') != '1')
            return { status: 'error', message: 'Requested for must be the sys_id of an active user. Use the user lookup tool first.' };

        // --- validate Action against the real choice list -----------------
        var actionValue = this._resolveActionValue(action);
        if (!actionValue)
            return { status: 'error', message: 'Action "' + action + '" is not a valid option. Use the action options tool and ask the user to choose.' };

        // --- validate Comments --------------------------------------------
        var commentText = (comments || '').toString().trim();
        if (!commentText)
            return { status: 'error', message: 'Comments are required. Ask the user for a short justification.' };

        // --- submit via the Service Catalog API ---------------------------
        try {
            var variables = {};
            variables[this.varRequestedFor] = user.getUniqueValue();
            variables[this.varAction] = actionValue;
            variables[this.varComments] = commentText;

            var cart = new sn_sc.CartJS();
            var result = cart.orderNow({
                sysparm_id: this.catItemSysId,
                sysparm_quantity: '1',
                sysparm_requested_for: user.getUniqueValue(),
                variables: variables
            });

            var requestSysId = result.request_id || result.sys_id;
            var ritmNumber = '';
            var ritm = new GlideRecord('sc_req_item');
            ritm.addQuery('request', requestSysId);
            ritm.addQuery('cat_item', this.catItemSysId);
            ritm.setLimit(1);
            ritm.query();
            if (ritm.next())
                ritmNumber = ritm.getValue('number');

            return {
                status: 'ok',
                request_number: result.request_number,
                request_sys_id: requestSysId,
                ritm_number: ritmNumber,
                link: gs.getProperty('glide.servlet.uri') + 'sp?id=ticket&table=sc_request&sys_id=' + requestSysId,
                message: 'Request ' + result.request_number + ' submitted for ' + user.getValue('name') + '.'
            };
        } catch (e) {
            gs.error('AccessRequestAgentUtils.submitRequest failed: ' + e);
            return { status: 'error', message: 'The request could not be submitted: ' + e };
        }
    },

    // ----------------------------------------------------------------------
    // private helpers
    // ----------------------------------------------------------------------

    _checkConfig: function() {
        if (!this.catItemSysId)
            return { status: 'error', message: 'System property ' + this.PROP_PREFIX + 'catalog_item_sys_id is not set.' };
        var item = new GlideRecord('sc_cat_item');
        if (!item.get(this.catItemSysId) || item.getValue('active') != '1')
            return { status: 'error', message: 'Catalog item ' + this.catItemSysId + ' was not found or is inactive.' };
        return null;
    },

    _getVariableSysId: function(varName) {
        var v = new GlideRecord('item_option_new');
        v.addQuery('cat_item', this.catItemSysId);
        v.addQuery('name', varName);
        v.setLimit(1);
        v.query();
        return v.next() ? v.getUniqueValue() : '';
    },

    // Accepts the choice value ("add") or its label ("Add"), case-insensitive.
    _resolveActionValue: function(action) {
        var wanted = (action || '').toString().trim().toLowerCase();
        if (!wanted)
            return '';
        var options = this.getActionOptions().options || [];
        for (var i = 0; i < options.length; i++) {
            if (options[i].value.toLowerCase() == wanted || options[i].label.toLowerCase() == wanted)
                return options[i].value;
        }
        return '';
    },

    type: 'AccessRequestAgentUtils'
};

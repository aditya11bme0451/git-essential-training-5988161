# Access Request Assistant: ServiceNow conversational AI agent

A chat agent built with **Now Assist AI Agent Studio** (with an optional **Now
Assist Skill Kit** skill). It asks the user for the three variables on your
existing catalog item, confirms them, and submits the request:

| Variable | How the agent collects it |
|---|---|
| Requested for | Asks for a name, email or "me", looks the user up in `sys_user`, and asks the user to choose when there are several matches |
| Action | Reads the Add / Remove choices from the catalog item, then asks the user to pick one |
| Comments | Free text, required |

```
User ──chat──► Access Request Assistant (AI Agent Studio)
                 ├─ Lookup user            (Script tool, autonomous)
                 ├─ Get action options     (Script tool, autonomous)
                 └─ Submit access request  (Script tool or NASK skill, supervised)
                          │
                          ▼
                 AccessRequestAgentUtils (Script Include) ──► sn_sc.CartJS.orderNow()
                                                              → REQ / RITM
```

## Files

| Path | What it is |
|---|---|
| `script_include/AccessRequestAgentUtils.js` | All server logic: user lookup, reading the Action choices, validating input, and submitting with `CartJS` |
| `tools/*.js` | The three AI Agent Studio Script tools |
| `agent/agent_definition.md` | Agent name, role, description, and full instructions to paste in |
| `nask_skill/submit_access_request_skill.md` | Optional Now Assist Skill Kit skill that wraps submission |
| `tests/background_script_test.js` | Background script to check the setup before chatting |

## Prerequisites

- Yokohama release or later, with **Now Assist** and **AI Agents** (Now Assist
  for ITSM or Now Assist for Creator/Platform) installed and licensed.
- Roles: `sn_aia.admin` (AI Agent Studio), `admin` for the script include and
  properties, and `sn_skill_builder.admin` if you build the NASK skill.
- Your catalog item's sys_id and the **internal names** of its three variables.
  Open the item, go to the *Variables* related list, and read the *Name* column.
  It is not the question label.

## Build steps

### 1. System properties

Create these in `sys_properties` (type `string`):

| Name | Value |
|---|---|
| `x_access_agent.catalog_item_sys_id` | sys_id of your catalog item |
| `x_access_agent.var.requested_for` | variable name, e.g. `requested_for` |
| `x_access_agent.var.action` | variable name, e.g. `action` |
| `x_access_agent.var.comments` | variable name, e.g. `comments` |

The three `var.*` properties default to `requested_for`, `action`, and
`comments`, so you only need to create the ones that differ.

### 2. Script Include

*System Definition → Script Includes → New*

- Name: `AccessRequestAgentUtils`
- Accessible from: **All application scopes**
- Client callable: unchecked
- Script: paste `script_include/AccessRequestAgentUtils.js`

### 3. Verify with a background script

Run `tests/background_script_test.js`. You should see your Add/Remove options and
your own user record. Set `SUBMIT = true` once to confirm a REQ is created with
the variables filled in, then set it back.

### 4. Create the AI agent

*All → AI Agent Studio → Create and manage → AI agents → New*

1. **Define the agent:** enter the name, description, role, and instructions
   from `agent/agent_definition.md`.
2. **Add tools:** for each file in `tools/`, choose *Add tool → Script*, use the
   name and description from its header comment, add the listed inputs, and
   paste the script. Set *Submit access request* to **Supervised** and the other
   two to **Autonomous**.
   - Optional: build the Skill Kit skill in `nask_skill/` and use it as tool 3
     instead (*Add tool → Now Assist skill*).
3. **Define security:** set *User access* to the roles or groups allowed to
   use the agent (e.g. `snc_internal`). Run tools as **the user interacting
   with the agent** so each request is created under the requester's own identity
   and ACLs.
4. **Select channels & status:** turn on **Now Assist panel** and/or **Virtual
   Agent** chat, set the agent to **Active**, and save.

### 5. Make it reachable in chat

- **Now Assist panel / Virtual Agent:** In *Now Assist Admin → Settings →
  Now Assist in Virtual Agent*, make sure AI agents are allowed in
  conversations. Users can then type something like *"I need to request access
  for Jane"* in the portal chat or Now Assist panel, and the orchestrator routes
  the conversation to this agent based on its description.
- **Optional dedicated entry point:** wrap the agent in an **agentic workflow**
  (*AI Agent Studio → Agentic workflows → New*) named "Submit access request",
  add this agent as its only agent, and activate it for the same channels.

### 6. Test in AI Agent Studio

Open the agent and click **Test**. Try these scenarios:

| Scenario | Expected behaviour |
|---|---|
| "I need access removed for John" | Looks up John and asks you to choose if there are several. Sets Action to Remove without asking, then asks for Comments |
| "Request access for me" | Uses your own user, then asks for Action and Comments |
| Ambiguous action ("change it") | Lists Add / Remove and asks again |
| Answer "no" to the summary | Asks what to change and does not submit |
| Answer "yes" | Approval prompt appears (Supervised). After you approve, it replies with the REQ and RITM numbers and a link |

## Example conversation

> **User:** Hi, I need to get someone added to the finance share
> **Agent:** Sure, I can help with an access request. Who is the request for?
> **User:** Priya
> **Agent:** I found 2 people: 1) Priya Shah (priya.shah@acme.com, Finance) 2) Priya Nair (priya.nair@acme.com, IT). Which one?
> **User:** the first
> **Agent:** Got it, Priya Shah. You said "added", so the action is **Add**. What access is needed, and why?
> **User:** Read access to the Finance shared drive for month-end close
> **Agent:** Here's the summary:
> Requested for: Priya Shah (priya.shah@acme.com)
> Action: Add
> Comments: Read access to the Finance shared drive for month-end close
> Shall I submit this request?
> **User:** yes
> **Agent:** Done! Request **REQ0010234** (RITM0010311) has been submitted. You can track it here: <link>

## Notes and troubleshooting

- **Variables come through empty on the RITM:** a variable name in the properties
  does not match the variable's *Name* field.
- **"Action ... is not a valid option":** the Action variable must be a Select
  Box or Multiple Choice variable with choices in `question_choice`.
- **Requested for on the REQ shows the agent user:** check that tools run as
  the interacting user (step 4.3). The variable value is set either way.
- **Catalog item has mandatory variables beyond these three, or UI policies:**
  `CartJS` enforces server-side checks but not client scripts. Add any extra
  variables to `submitRequest` and to the agent instructions.
- **Scoped app:** if you build this in a scoped application, change the
  `x_access_agent.` property prefix to your scope and replace `global.` in the
  tool scripts with your scope name.

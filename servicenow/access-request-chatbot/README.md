# Access Request Chatbot: Now Assist Skill Kit

A conversational chatbot built with the **Now Assist Skill Kit** only (no AI
Agent Studio). It chats with the user, collects the three variables on your
existing catalog item, shows a summary, and submits the request when the user
confirms.

| Variable | How the chatbot collects it |
|---|---|
| Requested for | Asks for a name, email or "me", looks the person up in `sys_user`, and asks the user to pick when several people match |
| Action | Offers the Add / Remove choices read from the catalog item and understands synonyms like "grant" or "revoke" |
| Comments | Free text, required |

## How it works

```
 Chat window (Service Portal widget)
        │  user message
        ▼
 AccessRequestChatEngine (Script Include) ── keeps the conversation in the user's session
        │  conversation history + verified state + Add/Remove options + user matches
        ▼
 Now Assist Skill Kit skill "Access Request Chat"  (LLM, one call per turn)
        │  JSON: next reply + answers it understood + stage
        ▼
 AccessRequestChatEngine
        ├─ checks each answer (real user? valid Action?) via AccessRequestCatalogUtils
        ├─ named a new person? looks them up and calls the skill again with the matches
        ├─ all answers known?  shows the summary and asks "Shall I submit?"
        └─ user said yes?      submits the catalog item (sn_sc.CartJS) → REQ / RITM
```

The Skill Kit skill handles the conversation itself: understanding free text,
picking up several answers in one message, handling corrections, and choosing
the next question. Creating the record is plain server code that only runs
after the user confirms, so the LLM can never submit something on its own.

## Files

| Path | What it is |
|---|---|
| `nask_skill/access_request_chat_skill.md` | **The Skill Kit skill:** inputs, the full prompt, test values, and how to publish it |
| `script_include/AccessRequestChatEngine.js` | Runs each chat turn: calls the skill, checks the answers, decides when to submit |
| `script_include/AccessRequestCatalogUtils.js` | User lookup, Action choices, and catalog submission via `CartJS` |
| `widget/*` | The chat window: a Service Portal widget (HTML, CSS, client and server script) |
| `tests/background_script_test.js` | Checks the setup and plays a full conversation from a background script |
| `SETUP_GUIDE.md` | Step-by-step configuration in ServiceNow |

## Prerequisites

- Now Assist installed with the **Now Assist Skill Kit** plugin
  (`sn_skill_builder`) and a working LLM provider (Now LLM Service or your own).
- Roles: `sn_skill_builder.admin` to build the skill, `admin` for the script
  includes, properties and widget.
- Your catalog item's sys_id and the **internal names** of its three variables.
  Open the item, go to the *Variables* related list, and read the *Name* column.
  It is not the question label.

## Build steps

Follow **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for the full click-by-click
configuration. In short:

1. Check plugins and roles, and note the catalog item's sys_id and variable names.
2. Create the `x_access_chat.*` system properties.
3. Create the two script includes.
4. Build, test and publish the Skill Kit skill.
5. Activate the skill and copy its two IDs into the properties.
6. Test from a background script.
7. Create the chat widget and a portal page for it.
8. Test end to end.

## Example conversation

> **Bot:** Hi! I can help you submit an access request. Who is the request for? You can give a name, an email, or say "me".
> **User:** Priya needs to be added to the finance share
> **Bot:** I found 2 people named Priya:
> 1. Priya Shah (priya.shah@acme.com, Finance)
> 2. Priya Nair (priya.nair@acme.com, IT)
>
> Which one is it?
> **User:** the first one
> **Bot:** Here is your request:
> Requested for: Priya Shah (priya.shah@acme.com)
> Action: Add
> Comments: Needs to be added to the finance share
> Shall I submit this request?
> **User:** change the comment to read access for month-end close
> **Bot:** Here is your request: … Comments: Read access for month-end close … Shall I submit this request?
> **User:** yes
> **Bot:** Done! Your request REQ0010234 (RITM0010311) has been submitted. You can track it using the link below. **[Open REQ0010234]**

## Safety rules built into the engine

- Only users returned by the server's own lookup can be chosen. A sys_id the
  model makes up is ignored.
- Only Action values that exist on the catalog item are accepted.
- The summary is built by the server from the stored answers, so the user
  confirms exactly what will be submitted.
- The request is submitted only when the previous bot message was that
  summary **and** the user's reply is a clear yes. Any change sends the user
  back to the summary.
- Submission runs as the logged-in user, so normal catalog ACLs and
  *Available for* restrictions still apply.

## Troubleshooting

| Symptom | Check |
|---|---|
| Bot says "I had trouble understanding that" | Look in *System Log → Errors* for `AccessRequestChatEngine`. Usually the skill IDs are wrong, the skill is unpublished, or the user lacks the role to run it |
| Log shows "Empty skill response" or a parse error | The response shape differs on your release. Compare `_callSkill()` with the script snippet the Skill Kit shows for the skill |
| Variables are empty on the RITM | A variable name in the properties does not match the variable's *Name* field |
| "Action ... is not a valid option" | The Action variable must be a Select Box or Multiple Choice variable with choices in `question_choice` |
| Item has other mandatory variables | Add them to `submitRequest()`, the skill prompt, and `_isComplete()` |
| Scoped app instead of global | Rename the `x_access_chat.` property prefix to your scope and replace `global.` in the widget server script |

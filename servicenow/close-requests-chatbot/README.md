# Close tasks/requests from Otto: step-by-step setup

A user types a sentence in Otto, such as *"I want to close RITM0012345, the
employee left"*. The chatbot:
- picks the numbers out of the sentence and works out whether each is a RITM
  or an SCTASK by looking it up;
- asks for whatever is missing (close code, business justification);
- shows a summary and, after the user says yes, submits your **Close
  tasks/requests** catalog item, with the RITMs in the RITM list collector
  and the SCTASKs in the task list collector.

```
User in Otto: "I want to close RITM0012345"
   │  Otto picks the topic "Close tasks or requests" (from its description)
   ▼
Virtual Agent topic ── loops once per user message ───────────────┐
   │                                                              │
   ▼                                                              │
CloseRequestChatEngine                                            │
   ├─ finds RITM/SCTASK numbers (regex) and looks them up         │
   │    exists? open? may this user close it? RITM or SCTASK?     │
   ├─ AI Skill Kit skill "Close Request Chat": next reply,        │
   │    close code, justification, numbers to remove              │
   ├─ missing info → asks ─────────────────────────────────────────┘
   └─ all known → summary → "yes" → submits "Close tasks/requests"
        RITMs  → RITM list collector (sc_req_item sys_ids)
        SCTASKs → task list collector (sc_task sys_ids)
```

The AI never decides whether a record exists or which type it is. That comes
from the record lookup. Every record is checked again just before submitting.

## Files

| File | Used in |
|---|---|
| `../close-record-skill/script_include/CloseRecordValidator.js` | Step 3: number detection and record lookup (shared) |
| `script_include/CloseRequestCatalogUtils.js` | Step 3: close code choices, submitting the item |
| `script_include/CloseRequestChatEngine.js` | Step 3: runs each chat turn |
| `nask_skill/close_request_chat_skill.md` | Step 4: the AI Skill Kit skill |
| `tests/background_script_test.js` | Step 5 |
| `virtual_agent_topic/*.js` | Step 6: scripts for the Otto topic |

---

## Step 1: Prerequisites

1. **System Definition → Plugins:** check that these are installed:
   - **Now Assist Skill Kit**
   - a licensed Now Assist app
   - **Glide Virtual Agent** with Now Assist in Virtual Agent (Otto runs
     topics through it)
2. **Roles:** `admin`, `sn_skill_builder.admin`, `now_assist_admin`,
   `virtual_agent_admin`.
3. **Number format:** open **System Definition → Number Maintenance** and
   check the **Number of digits** for `sc_req_item` and `sc_task`. The
   default is 7 (RITM0012345). If yours differ, change `NUMBER_DIGITS` in
   `CloseRecordValidator.js` (step 3). Short numbers the user types, such as
   `RITM12345`, are padded to this length.

## Step 2: Collect the catalog item details

1. Go to **Service Catalog → Catalog Definitions → Maintain Items** and open
   **Close tasks/requests**.
2. Right-click the header, choose **Copy sys_id**, and save it.
3. In **Variables**, note the **Name** (not the Question) of:

   | Variable | Type | Default name the scripts expect |
   |---|---|---|
   | Requested items to close | List Collector → `sc_req_item` | `requested_items` |
   | Tasks to close | List Collector → `sc_task` | `catalog_tasks` |
   | Close code | Select Box (or text) | `close_code` |
   | Business justification | Multi Line Text | `business_justification` |

4. Open the **Close code** variable and check its **Question Choices**. The
   chatbot offers exactly these. If it has no choices, the chatbot accepts
   free text.
5. Make sure the item is **Active** and available to the users who will use
   Otto.

## Step 3: System properties and script includes

**Properties.** Go to **sys_properties.list → New** and create these (type
string):

| Name | Value |
|---|---|
| `x_close_chat.catalog_item_sys_id` | sys_id from step 2 |
| `x_close_chat.var.ritms` | RITM list collector name, if not `requested_items` |
| `x_close_chat.var.tasks` | task list collector name, if not `catalog_tasks` |
| `x_close_chat.var.close_code` | close code variable name, if not `close_code` |
| `x_close_chat.var.justification` | justification variable name, if not `business_justification` |
| `x_close_chat.enforce_permission` | `true`: users may only close records they requested, are requested-for on, or whose assignment group they belong to. `false`: allow any open record |
| `x_close_chat.skill.capability_sys_id` | leave empty, filled in step 4 |
| `x_close_chat.skill.config_sys_id` | leave empty, filled in step 4 |

**Script includes.** Go to **System Definition → Script Includes → New**.
Create each one with **Accessible from: All application scopes**, **Client
callable** unchecked, and **Active** checked, in this order:

1. `CloseRecordValidator`: paste `../close-record-skill/script_include/CloseRecordValidator.js`
   (skip if you already created it)
2. `CloseRequestCatalogUtils`: paste `script_include/CloseRequestCatalogUtils.js`
3. `CloseRequestChatEngine`: paste `script_include/CloseRequestChatEngine.js`

## Step 4: Build the AI Skill Kit skill

Follow `nask_skill/close_request_chat_skill.md`:

1. Go to **Now Assist Skill Kit → Home → Create skill**. Set **Name** to
   `Close Request Chat` and paste the description.
2. Add five String inputs: `conversation_history`, `user_message`,
   `current_state`, `records_in_message`, `close_code_options`.
3. Choose the provider. Paste the prompt and re-insert each `{{...}}` with
   **Insert input**.
4. **Run tests** with the sample values. The reply should confirm the RITM,
   mention its open task, and ask for the close code.
5. Click **Finalize prompt**, then **Publish**.
6. Go to **Now Assist Admin → Now Assist Features → Other → Available**,
   click **Activate skill**, choose who can use it, then **Activate**.
7. Copy the two sys_ids into the properties:
   - from **sys_one_extend_capability.list** into `x_close_chat.skill.capability_sys_id`
   - from **sn_nowassist_skill_config.list** into `x_close_chat.skill.config_sys_id`

## Step 5: Test from a background script

1. Go to **System Definition → Scripts - Background** and paste
   `tests/background_script_test.js`.
2. Set `RITM` and `SCTASK` at the top to real, open records you're allowed to
   close.
3. Click **Run script** and check:
   - Line 1 is `null` (configuration OK).
   - Line 2 lists your close codes.
   - Lines 3 and 4 show `"status":"ok"` with the right `record_type`.
   - The BOT lines pick up the RITM from *"I want to close …"*, add the
     SCTASK, ask for the close code, then the justification, and end with the
     summary.
4. Set `SUBMIT = true` and run it once more. Open the new request and check
   that the RITM list collector holds the RITM, the task list collector holds
   the SCTASK, and close code and justification are filled. Then set
   `SUBMIT` back to `false`.

## Step 6: Create the Otto topic

1. Go to **All → Conversational Interfaces → Virtual Agent → Designer →
   Create → Topic**. If asked, choose **LLM** discovery.
2. On the **Properties** tab:
   - **Name:** `Close tasks or requests`
   - **Description** (Otto uses this to pick the topic; paste exactly):
     > Close, cancel or complete one or more requested items (RITM) or
     > catalog tasks (SCTASK). Use when someone says they want to close,
     > cancel, complete or finish a RITM or SCTASK number, for example
     > "I want to close RITM0012345".
   - **Discoverable:** checked
   - **Channels:** check every Now Assist / Otto option shown
   - **Who can access this topic:** the users who may close records, for
     example `snc_internal`
   - Click **Save**.
3. **Variables { }:** add four String topic variables: `chat_state`,
   `bot_reply`, `chat_done`, `request_link`.
4. **Flow** tab: add these nodes in order, connecting each to the next.
   Switch each script field to script mode before pasting.

   | # | Node (palette) | Settings |
   |---|---|---|
   | 1 | **Start chat** (Utilities → Script Action) | Action expression: `virtual_agent_topic/1_start_chat_script_action.js` |
   | 2 | **Chat turn** (User Input → Text) | Variable name `user_message`; Question (script): `virtual_agent_topic/2_chat_turn_prompt.js` |
   | 3 | **Process message** (Utilities → Script Action) | `virtual_agent_topic/3_process_message_script_action.js` |
   | 4 | **Finished?** (Utilities → Decision) | Branch **Finished**: condition `virtual_agent_topic/4_is_done_condition.js`. Branch **Continue**: default |
   | 5 | **Final reply** (Bot Response → Text), on *Finished* | Message (script): `virtual_agent_topic/5_final_reply_text.js` |
   | 6 | **Open my request** (Bot Response → Link) | URL (script) and condition from `virtual_agent_topic/6_request_link.js`; then connect to **End** |

5. Connect the **Continue** branch back to **Chat turn**. If the designer
   won't connect back to an earlier node, use a **Jump To** node pointing at
   Chat turn.

   ```
   Start → Start chat → Chat turn → Process message → Finished? ─Finished→ Final reply → Open my request → End
                            ▲                              │
                            └────────── Continue ──────────┘
   ```

6. Click **Save**, then **Test**. Because the designer test doesn't start
   from an Otto message, the first bubble asks for the numbers. Type
   `RITM0012345` (a real one), then a close code, a justification, and `yes`.
7. Click **Publish**.

## Step 7: Make it available in Otto

1. Go to **All → Conversational Interfaces → Home** (or **Assistant
   Designer**), open the assistant Otto chat uses, and check that **LLM topic
   discovery** is on.
2. In its **Topics**, add **Close tasks or requests** if it isn't listed, then
   save.
3. Stop Otto from opening the plain catalog form for the item. If Otto starts
   its own catalog ordering for *Close tasks/requests* instead of this topic,
   do one or both of these:
   - make the topic description more specific;
   - exclude the catalog item from conversational ordering. List collectors
     generally aren't supported there anyway.

## Step 8: Test in Otto

Log in as a normal user and open Otto.

| You type | Expected |
|---|---|
| `I want to close RITM0012345` | *"I've added RITM0012345 (Requested Item: …)."* Asks for the close code without asking whether it's a RITM or a task |
| `close RITM0012345 and SCTASK0012399, the employee left` | Both added (the type comes from the lookup), justification captured, asks only for the close code |
| `close ritm 12345` | Tidied up to RITM0012345 and found |
| A number that doesn't exist, is already closed, or isn't yours | Says so and doesn't add it |
| At the summary: `remove SCTASK0012399` | Summary shown again without it |
| At the summary: `yes` | *"Done! Your request REQ… to close … has been submitted"*, plus **Open my request** |
| `cancel` | Nothing is submitted |

Then open the submitted request and check the list collectors, close code
and justification. Your existing fulfilment flow for the item then closes
the records as before.

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"closing requests is not available right now (Variable … not found)"* | A variable name property doesn't match the variable's **Name** (step 2) |
| *"I had trouble understanding that"* | Check **System Logs → Errors** for `CloseRequestChatEngine`: the skill IDs are wrong, the skill is inactive, or the user lacks access to it |
| The opening sentence's number is asked for again | The topic was started some other way than an Otto message (for example the designer's Test). In Otto, check that node 1 uses `vaSystem.getSearchText()` |
| `RITM123456` *not found* but it exists | Number length differs from `NUMBER_DIGITS` (step 1.3) |
| Records the user should be able to close show *not allowed* | Set `x_close_chat.enforce_permission` to `false`, or adjust `canClose()` in `CloseRecordValidator` |
| List collector empty on the submitted request | Wrong variable name in `x_close_chat.var.ritms` / `x_close_chat.var.tasks` |
